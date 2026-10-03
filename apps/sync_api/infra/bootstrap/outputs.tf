output "state_bucket_name" {
  description = "Name of the created Terraform state bucket"
  value       = google_storage_bucket.tfstate.name
}
