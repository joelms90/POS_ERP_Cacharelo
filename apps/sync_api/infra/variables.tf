variable "project_id" {
  description = "Google Cloud Project ID where resources will be deployed"
  type        = string
}

variable "region" {
  description = "GCP Region for Cloud Run, Artifact Registry, and Cloud SQL"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Password for the Cloud SQL PostgreSQL user"
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Admin access password for the User Manager Dashboard"
  type        = string
  sensitive   = true
  default     = "admin123"
}

variable "admin_email" {
  description = "Email address to send monitoring alerts"
  type        = string
  default     = "joelms90@gmail.com"
}
