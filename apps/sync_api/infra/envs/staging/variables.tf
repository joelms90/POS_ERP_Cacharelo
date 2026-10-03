variable "project_id" {
  description = "GCP project id for the staging environment"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "releases_bucket_name" {
  description = "GCS bucket for staging APK / release downloads"
  type        = string
  default     = "cacharelo-pos-releases-staging"
}
