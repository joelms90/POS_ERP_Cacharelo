variable "project_id" {
  description = "Project that will own the Terraform state bucket"
  type        = string
}

variable "region" {
  description = "Bucket location/region"
  type        = string
  default     = "us-central1"
}

variable "state_bucket_name" {
  description = "Globally unique GCS bucket name for Terraform remote state"
  type        = string
  default     = "cacharelo-tfstate"
}
