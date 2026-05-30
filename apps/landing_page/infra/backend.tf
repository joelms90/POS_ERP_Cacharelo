terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Uncomment and configure this block once you have manually created the GCS bucket to store the state.
  # backend "gcs" {
  #   bucket = "your-terraform-state-bucket"
  #   prefix = "landing-page/state"
  # }
}
