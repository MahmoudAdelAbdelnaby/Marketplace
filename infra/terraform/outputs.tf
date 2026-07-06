output "frontend_url" {
  description = "The public URL of the React/Vite frontend application."
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_url" {
  description = "The public URL of the FastAPI backend application."
  value       = google_cloud_run_v2_service.backend.uri
}

output "artifact_registry_repo" {
  description = "The repository path in Artifact Registry for building and pushing Docker images."
  value       = "${google_artifact_registry_repository.hub_repo.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.hub_repo.repository_id}"
}

output "cloud_sql_connection_name" {
  description = "The database connection name for configuring local proxies or debugging."
  value       = google_sql_database_instance.postgres.connection_name
}

output "uploads_bucket_name" {
  description = "The Google Cloud Storage bucket name for storing uploads and assets."
  value       = google_storage_bucket.uploads_bucket.name
}

output "database_user" {
  description = "The master user created for database access."
  value       = var.db_user
}

output "database_password" {
  description = "The master password for database access (retrieved from random generator or variables)."
  value       = local.db_pass
  sensitive   = true
}
