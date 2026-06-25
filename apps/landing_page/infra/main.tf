provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable required APIs dynamically
resource "google_project_service" "services" {
  for_each = toset([
    "cloudfunctions.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com"
  ])

  service            = each.key
  disable_on_destroy = false
}

# Fetch project metadata
data "google_project" "project" {}

# =====================================================================
# CUENTAS DE SERVICIO PERSONALIZADAS
# =====================================================================
resource "google_service_account" "function_sa" {
  account_id   = "gcf-submit-inquiry-sa"
  display_name = "Custom Service Account for Submit Inquiry Runtime"
  depends_on   = [google_project_service.services]
}

resource "google_service_account" "build_sa" {
  account_id   = "gcf-custom-builder-sa"
  display_name = "Custom Service Account for Cloud Build"
  depends_on   = [google_project_service.services]
}

# Permisos Build SA
resource "google_project_iam_member" "custom_build_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.build_sa.email}"
}

resource "google_project_iam_member" "custom_build_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.build_sa.email}"
}

resource "google_project_iam_member" "custom_build_artifactregistry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.build_sa.email}"
}

resource "google_service_account_iam_member" "custom_build_act_as" {
  service_account_id = google_service_account.function_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.build_sa.email}"
}

# Permisos Function SA (Logging and Firestore/Datastore access)
resource "google_project_iam_member" "function_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.function_sa.email}"
}

resource "google_project_iam_member" "function_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.function_sa.email}"
}

# Tiempo de espera para propagación de APIs e IAM
resource "time_sleep" "wait_for_apis_and_iam" {
  create_duration = "30s"
  depends_on = [
    google_project_service.services,
    google_service_account.function_sa,
    google_service_account.build_sa,
    google_project_iam_member.custom_build_logging,
    google_project_iam_member.custom_build_storage,
    google_project_iam_member.custom_build_artifactregistry,
    google_service_account_iam_member.custom_build_act_as,
    google_project_iam_member.function_logging,
    google_project_iam_member.function_firestore
  ]
}

# 1. GCS Bucket para el Hosting del Frontend Estático
resource "google_storage_bucket" "frontend_bucket" {
  name                        = var.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  depends_on = [time_sleep.wait_for_apis_and_iam]
}

# Hacer público el bucket del frontend
resource "google_storage_bucket_iam_member" "public_rule" {
  bucket = google_storage_bucket.frontend_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# 2. Bucket exclusivo para el código de la función
resource "google_storage_bucket" "function_bucket" {
  name                        = "${var.project_id}-landing-functions"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
  depends_on                  = [time_sleep.wait_for_apis_and_iam]
}

# Zip the backend source code dynamically
data "archive_file" "function_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/dist/function.zip"
  excludes    = ["node_modules", "dist", "src/index.test.ts", "vitest.config.ts"]
}

# Upload the zip archive to GCS
resource "google_storage_bucket_object" "function_zip_object" {
  name       = "function-${data.archive_file.function_zip.output_md5}.zip"
  bucket     = google_storage_bucket.function_bucket.name
  source     = data.archive_file.function_zip.output_path
  depends_on = [google_storage_bucket.function_bucket]
}

# 6. Google Cloud Function (2nd Gen)
resource "google_cloudfunctions2_function" "submit_inquiry" {
  name        = var.function_name
  location    = var.region
  description = "HTTPS Contact Form Inquiry Function for Grupo Cacharelo"

  build_config {
    runtime         = "nodejs22"
    entry_point     = "submitInquiry"
    service_account = "projects/${var.project_id}/serviceAccounts/${google_service_account.build_sa.email}"

    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.function_zip_object.name
      }
    }
  }

  service_config {
    max_instance_count    = 3
    available_memory      = "256Mi"
    timeout_seconds       = 60
    ingress_settings      = "ALLOW_ALL"
    service_account_email = google_service_account.function_sa.email
  }

  depends_on = [
    time_sleep.wait_for_apis_and_iam,
    google_storage_bucket_object.function_zip_object
  ]
}

# Allow unauthenticated (public) invocations of the HTTPS GCF v2 function
resource "google_cloud_run_service_iam_member" "invoker" {
  location = google_cloudfunctions2_function.submit_inquiry.location
  service  = google_cloudfunctions2_function.submit_inquiry.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
