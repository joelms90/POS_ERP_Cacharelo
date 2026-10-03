terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

locals {
  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
  database_url = "postgresql://${var.db_user}:${random_password.db.result}@/${var.db_name}?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}"
}

# 1. Enable required GCP APIs
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# 2. Docker Artifact Registry repository
resource "google_artifact_registry_repository" "pos_repo" {
  depends_on    = [google_project_service.services]
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_id
  description   = "Docker repository for the POS sync backend (${var.environment})"
  format        = "DOCKER"
}

# 3. Secret Manager secrets
resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "random_password" "admin" {
  length  = 20
  special = false
}

resource "google_secret_manager_secret" "db_password" {
  depends_on = [google_project_service.services]
  project    = var.project_id
  secret_id  = "pos-db-password"
  labels     = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db.result
}

resource "google_secret_manager_secret" "database_url" {
  depends_on = [google_project_service.services]
  project    = var.project_id
  secret_id  = "pos-database-url"
  labels     = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = local.database_url
}

resource "google_secret_manager_secret" "jwt_secret" {
  depends_on = [google_project_service.services]
  project    = var.project_id
  secret_id  = "pos-jwt-secret"
  labels     = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = random_password.jwt.result
}

resource "google_secret_manager_secret" "admin_password" {
  depends_on = [google_project_service.services]
  project    = var.project_id
  secret_id  = "pos-admin-password"
  labels     = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "admin_password" {
  secret      = google_secret_manager_secret.admin_password.id
  secret_data = random_password.admin.result
}

# 4. Cloud SQL PostgreSQL
resource "google_sql_database_instance" "postgres" {
  depends_on          = [google_project_service.services]
  project             = var.project_id
  name                = var.db_instance_name
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    user_labels       = local.labels
    availability_type = "ZONAL"

    ip_configuration {
      ipv4_enabled = true
    }
  }
}

resource "google_sql_database" "db" {
  project  = var.project_id
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "user" {
  project  = var.project_id
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db.result
}

# 5. Service account for Cloud Run
resource "google_service_account" "cloud_run_sa" {
  depends_on   = [google_project_service.services]
  project      = var.project_id
  account_id   = "cloud-run-pos-sa"
  display_name = "Cloud Run POS API Service Account (${var.environment})"
}

resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# 6. Cloud Run service (image is managed by the deploy command)
resource "google_cloud_run_v2_service" "api" {
  depends_on = [
    google_project_service.services,
    google_sql_user.user,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.jwt_secret,
    google_secret_manager_secret_version.admin_password,
  ]
  project  = var.project_id
  name     = var.service_name
  location = var.region
  labels   = local.labels
  ingress  = var.allow_public ? "INGRESS_TRAFFIC_ALL" : "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.cloud_run_sa.email

    annotations = {
      "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.postgres.connection_name
      "run.googleapis.com/startup-cpu-boost"  = "true"
    }

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.placeholder_image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "ENABLE_GCP_INTEGRATIONS"
        value = "true"
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "PG_POOL_MAX"
        value = "5"
      }
      env {
        name  = "PG_IDLE_TIMEOUT_MS"
        value = "30000"
      }
      env {
        name  = "PG_CONNECTION_TIMEOUT_MS"
        value = "5000"
      }
      env {
        name  = "TAKEAWAY_SELF_HEAL_INTERVAL_MS"
        value = "60000"
      }

      dynamic "env" {
        for_each = var.extra_env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "ADMIN_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.admin_password.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.allow_public ? 1 : 0
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 7. Optional GCS bucket for APK / release downloads
resource "google_storage_bucket" "releases" {
  count                       = var.releases_bucket_name != "" ? 1 : 0
  project                     = var.project_id
  name                        = var.releases_bucket_name
  location                    = "US"
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

resource "google_storage_bucket_iam_member" "releases_public" {
  count  = var.releases_bucket_name != "" ? 1 : 0
  bucket = google_storage_bucket.releases[0].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
