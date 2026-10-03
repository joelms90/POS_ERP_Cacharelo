terraform {
  backend "gcs" {
    bucket = "cacharelo-tfstate"
    prefix = "sync-api/staging"
  }
}
