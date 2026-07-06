variable "project_id" {
  description = "The GCP Project ID where resources will be provisioned."
  type        = string
}

variable "region" {
  description = "The GCP region for provisioning resources."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod)."
  type        = string
  default     = "prod"
}

variable "db_user" {
  description = "The database administrator username."
  type        = string
  default     = "hub_admin"
}

variable "db_password" {
  description = "The database administrator password. If empty, a random password will be generated."
  type        = string
  default     = ""
  sensitive   = true
}

variable "backend_image" {
  description = "The container image URL for the FastAPI backend. Can point to a placeholder initially."
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "frontend_image" {
  description = "The container image URL for the Vite frontend. Can point to a placeholder initially."
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "hub_secret" {
  description = "Secret key used by the backend API to sign JWT auth tokens."
  type        = string
  default     = "production-jwt-signing-secret-change-me"
  sensitive   = true
}
