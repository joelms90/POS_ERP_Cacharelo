variable "project_id" {
  description = "GCP project id where the environment is deployed"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Cloud SQL and Artifact Registry"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (e.g. staging, prod). Used for labels."
  type        = string
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "pos-sync-api"
}

variable "artifact_repo_id" {
  description = "Artifact Registry docker repository id"
  type        = string
  default     = "pos-repo"
}

variable "placeholder_image" {
  description = "Image used on first apply; replaced by the deploy command"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "db_instance_name" {
  description = "Cloud SQL instance name"
  type        = string
  default     = "pos-db-instance"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "pos_db"
}

variable "db_user" {
  description = "PostgreSQL user name"
  type        = string
  default     = "pos_user"
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the Cloud SQL instance"
  type        = bool
  default     = false
}

variable "min_instances" {
  description = "Cloud Run minimum instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Cloud Run maximum instances"
  type        = number
  default     = 3
}

variable "cpu" {
  description = "Cloud Run container CPU limit"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Cloud Run container memory limit"
  type        = string
  default     = "512Mi"
}

variable "allow_public" {
  description = "Allow unauthenticated public invocations"
  type        = bool
  default     = true
}

variable "releases_bucket_name" {
  description = "Optional GCS bucket for APK/release downloads (empty disables)"
  type        = string
  default     = ""
}

variable "extra_env" {
  description = "Additional non-secret environment variables for Cloud Run"
  type        = map(string)
  default     = {}
}
