terraform {
  required_version = ">= 1.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ----------------------------------------------------------------- Enable Services
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# ----------------------------------------------------------------- Artifact Registry
resource "google_artifact_registry_repository" "hub_repo" {
  depends_on    = [google_project_service.services]
  location      = var.region
  repository_id = "analytics-ai-hub"
  description   = "Docker repository for Analytics AI Hub images"
  format        = "DOCKER"
}

# ----------------------------------------------------------------- Storage Buckets
resource "google_storage_bucket" "uploads_bucket" {
  depends_on                  = [google_project_service.services]
  name                        = "${var.project_id}-analytics-hub-uploads"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Make bucket files publicly readable (useful for serving uploaded videos/PPT files)
resource "google_storage_bucket_iam_binding" "public_read" {
  bucket = google_storage_bucket.uploads_bucket.name
  role   = "roles/storage.objectViewer"
  members = [
    "allUsers"
  ]
}

# ----------------------------------------------------------------- Cloud SQL (PostgreSQL)
resource "random_password" "db_password" {
  length  = 16
  special = false
}

locals {
  db_pass = var.db_password != "" ? var.db_password : random_password.db_password.result
}

resource "google_sql_database_instance" "postgres" {
  depends_on          = [google_project_service.services]
  name                = "analytics-hub-db"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = false

  settings {
    tier = "db-f1-micro" # Shared CPU, 0.6 GB RAM - lowest cost dev tier
    ip_configuration {
      ipv4_enabled = true # Enables public IP for simple integration (secured via IAM / SSL)
    }
  }
}

resource "google_sql_database" "hub_db" {
  name     = "analytics_hub"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "db_user" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = local.db_pass
}

# ----------------------------------------------------------------- Secrets Manager
resource "google_secret_manager_secret" "db_url" {
  depends_on = [google_project_service.services]
  secret_id  = "database-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_url_value" {
  secret = google_secret_manager_secret.db_url.id
  secret_data = "postgresql://${var.db_user}:${local.db_pass}@/analytics_hub?host=/cloudsql/${var.project_id}:${var.region}:${google_sql_database_instance.postgres.name}"
}

# ----------------------------------------------------------------- Service Account for Backend
resource "google_service_account" "backend_sa" {
  account_id   = "analytics-hub-backend-sa"
  display_name = "Service Account for Analytics Hub Backend Cloud Run"
}

# Grant backend service account access to PostgreSQL
resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Grant backend service account access to Secret Manager DB Secret
resource "google_secret_manager_secret_iam_member" "db_url_access" {
  secret_id = google_secret_manager_secret.db_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

# Grant backend service account access to uploads bucket
resource "google_storage_bucket_iam_member" "uploads_admin" {
  bucket = google_storage_bucket.uploads_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# ----------------------------------------------------------------- Cloud Run Services

# 1. Backend Service
resource "google_cloud_run_v2_service" "backend" {
  depends_on = [google_project_service.services, google_service_account.backend_sa]
  name       = "analytics-hub-api"
  location   = var.region
  ingress    = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.backend_sa.email

    containers {
      image = var.backend_image

      ports {
        container_port = 8080
      }

      env {
        name  = "HUB_SECRET"
        value = var.hub_secret
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "UPLOADS_BUCKET"
        value = google_storage_bucket.uploads_bucket.name
      }
    }

    # Connect Cloud SQL instance to the Cloud Run environment
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.postgres.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# 2. Frontend Service
resource "google_cloud_run_v2_service" "frontend" {
  depends_on = [google_project_service.services]
  name       = "analytics-hub-web"
  location   = var.region
  ingress    = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.frontend_image
      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# ----------------------------------------------------------------- Public Service Exposure (No Auth)
resource "google_cloud_run_v2_service_iam_binding" "backend_public" {
  name     = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  members = [
    "allUsers"
  ]
}

resource "google_cloud_run_v2_service_iam_binding" "frontend_public" {
  name     = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role     = "roles/run.invoker"
  members = [
    "allUsers"
  ]
}
