terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "sync_api" {
  source = "../../modules/sync-api"

  project_id   = var.project_id
  region       = var.region
  environment  = "staging"
  service_name = "pos-sync-api"

  db_instance_name       = "pos-db-instance"
  db_tier                = "db-f1-micro"
  db_deletion_protection = false

  min_instances = 0
  max_instances = 3
  cpu           = "1"
  memory        = "512Mi"

  releases_bucket_name = var.releases_bucket_name
}

output "api_url" {
  value = module.sync_api.api_url
}

output "db_connection_name" {
  value = module.sync_api.db_connection_name
}

output "service_account_email" {
  value = module.sync_api.service_account_email
}

output "db_password_secret" {
  value = module.sync_api.db_password_secret
}
