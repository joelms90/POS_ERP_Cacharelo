output "website_url" {
  value       = "http://${google_storage_bucket.frontend_bucket.name}.storage.googleapis.com/index.html"
  description = "The public URL to access the landing page index"
}

output "website_bucket_name" {
  value       = google_storage_bucket.frontend_bucket.name
  description = "The name of the GCS bucket hosting the frontend"
}

output "function_url" {
  value       = google_cloudfunctions2_function.submit_inquiry.service_config[0].uri
  description = "The HTTPS URL of the submit-inquiry Cloud Function"
}
