output "api_url" {
  description = "Public URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.api.uri
}

output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.api.name
}

output "db_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_url_secret" {
  description = "Secret Manager secret id holding the full DATABASE_URL"
  value       = google_secret_manager_secret.database_url.secret_id
}

output "db_password_secret" {
  description = "Secret Manager secret id holding the DB password"
  value       = google_secret_manager_secret.db_password.secret_id
}

output "service_account_email" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloud_run_sa.email
}

output "artifact_repo" {
  description = "Artifact Registry repository id"
  value       = google_artifact_registry_repository.pos_repo.repository_id
}

output "releases_bucket" {
  description = "GCS bucket for downloads (empty if disabled)"
  value       = var.releases_bucket_name
}
