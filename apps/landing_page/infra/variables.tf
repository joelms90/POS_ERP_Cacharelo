variable "project_id" {
  type        = string
  description = "The Google Cloud Platform project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "The GCP region for provisioning resources"
}

variable "bucket_name" {
  type        = string
  description = "The name of the GCS bucket for hosting the static website"
}

variable "function_name" {
  type        = string
  default     = "submit-inquiry"
  description = "The name of the Google Cloud Function"
}
