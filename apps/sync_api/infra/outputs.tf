output "admin_dashboard_url" {
  description = "The public URL to access the User Manager Admin Dashboard website"
  value       = "http://${google_storage_bucket.admin_bucket.name}.storage.googleapis.com/index.html"
}

output "api_backend_url" {
  description = "The public URL of the serverless Cloud Run POS Sync API"
  value       = google_cloud_run_service.pos_api.status[0].url
}

output "database_connection_name" {
  description = "The database instance connection name for SQL proxies"
  value       = google_sql_database_instance.postgres_instance.connection_name
}
