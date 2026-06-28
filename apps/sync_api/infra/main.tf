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

# 1. Enable Required GCP APIs
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "cloudbuild.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# 2. Docker Artifact Registry Repository
resource "google_artifact_registry_repository" "pos_repo" {
  depends_on    = [google_project_service.services]
  location      = var.region
  repository_id = "pos-repo"
  description   = "Docker repository for Empire POS sync backend container"
  format        = "DOCKER"
}

# 3. Google Cloud Storage Bucket for Static Web Admin Dashboard
resource "google_storage_bucket" "admin_bucket" {
  depends_on                  = [google_project_service.services]
  name                        = "empire-pos-admin-dashboard-${var.project_id}"
  location                    = "US" # Multi-regional for CDN caching
  force_destroy               = true
  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Make GCS website files publicly readable (allUsers read)
resource "google_storage_bucket_iam_member" "public_rule" {
  bucket = google_storage_bucket.admin_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# 4. Cloud SQL PostgreSQL Database Instance (Micro-tier for budget)
resource "google_sql_database_instance" "postgres_instance" {
  depends_on          = [google_project_service.services]
  name                = "pos-db-instance"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = false # Set to true for production systems

  settings {
    tier = "db-f1-micro" # Shared CPU instance (cheapest, ~$9.50/mo)

    ip_configuration {
      ipv4_enabled = true # Enabled for secure Cloud SQL Proxy access
    }
  }
}

# Database
resource "google_sql_database" "pos_db" {
  name     = "pos_db"
  instance = google_sql_database_instance.postgres_instance.name
}

# Database User
resource "google_sql_user" "pos_db_user" {
  name     = "pos_user"
  instance = google_sql_database_instance.postgres_instance.name
  password = var.db_password
}

# 5. Service Account for Cloud Run to Securely Access Cloud SQL
resource "google_service_account" "cloud_run_sa" {
  account_id   = "cloud-run-pos-sa"
  display_name = "Cloud Run Service Account for POS API"
}

# Grant Cloud SQL Client access to the Service Account
resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant Firestore Access (Datastore User) to the Service Account
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# 6. Cloud Run Service for the Express API
resource "google_cloud_run_service" "pos_api" {
  depends_on = [
    google_project_service.services,
    google_sql_user.pos_db_user
  ]
  name     = "pos-sync-api"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.cloud_run_sa.email

      containers {
        # Initial container image pull path (replaces with built version once pushed)
        image = "${var.region}-docker.pkg.dev/${var.project_id}/pos-repo/sync-api:latest"

        env {
          name  = "ADMIN_PASSWORD"
          value = var.admin_password
        }
        # Connection string to PostgreSQL instance via Cloud SQL Proxy socket
        env {
          name  = "DATABASE_URL"
          value = "postgresql://pos_user:${var.db_password}@/pos_db?host=/cloudsql/${google_sql_database_instance.postgres_instance.connection_name}"
        }

        # Mount Cloud SQL proxy socket into container
        resources {
          limits = {
            memory = "512Mi"
            cpu    = "1000m"
          }
        }
      }
    }

    metadata {
      annotations = {
        # Connect Cloud SQL socket mapping to container filesystem
        "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.postgres_instance.connection_name
        "run.googleapis.com/client-name"        = "terraform"
        # Allocate CPU only during request processing (free-tier budget safety)
        "run.googleapis.com/cpu-throttling"     = "true"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Allow public invocations for public terminals to authenticate and sync
resource "google_cloud_run_service_iam_member" "public_run_access" {
  location = google_cloud_run_service.pos_api.location
  service  = google_cloud_run_service.pos_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Fetch project details to retrieve project number dynamically
data "google_project" "project" {}

# Grant Compute service account viewer rights to read Cloud Build sources in GCS
resource "google_project_iam_member" "compute_storage_viewer" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Grant Compute service account writer rights to push images to Artifact Registry
resource "google_project_iam_member" "compute_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Grant Compute service account logs writer rights for build logs
resource "google_project_iam_member" "compute_logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Create Firestore composite index for inquiries queries
resource "google_firestore_index" "inquiries_composite_index" {
  project    = var.project_id
  database   = "(default)"
  collection = "contact_inquiries"

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }

  fields {
    field_path = "createdAt"
    order      = "DESCENDING"
  }
}
