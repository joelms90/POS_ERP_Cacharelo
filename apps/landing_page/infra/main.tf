provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. GCS Bucket for Static Frontend Web Hosting
resource "google_storage_bucket" "frontend_bucket" {
  name                        = var.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

# Make the frontend bucket public
resource "google_storage_bucket_iam_member" "public_rule" {
  bucket = google_storage_bucket.frontend_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# 2. GCS Bucket for Function Source Code Archives
resource "google_storage_bucket" "function_bucket" {
  name                        = "${var.bucket_name}-functions"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}

# Zip the backend source code dynamically
data "archive_file" "function_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/dist/function.zip"
  excludes    = [
    "node_modules",
    "dist",
    "src/index.test.ts",
    "vitest.config.ts"
  ]
}

# Upload the zip archive to GCS
resource "google_storage_bucket_object" "function_zip_object" {
  name   = "function-${data.archive_file.function_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_bucket.name
  source = data.archive_file.function_zip.output_path
}

# 3. Google Cloud Function (2nd Gen)
resource "google_cloudfunctions2_function" "submit_inquiry" {
  name        = var.function_name
  location    = var.region
  description = "HTTPS Contact Form Inquiry Function for Grupo Cacharelo"

  build_config {
    runtime     = "nodejs22"
    entry_point = "submitInquiry"
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.function_zip_object.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    available_memory   = "256Mi"
    timeout_seconds    = 60
    ingress_settings   = "ALLOW_ALL"
  }
}

# Allow unauthenticated (public) invocations of the HTTPS GCF v2 function
resource "google_cloud_run_service_iam_member" "invoker" {
  location = google_cloudfunctions2_function.submit_inquiry.location
  service  = google_cloudfunctions2_function.submit_inquiry.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
