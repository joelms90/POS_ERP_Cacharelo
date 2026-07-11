# Always Free GCP VM Docker Deployment Setup

The dedicated WebSocket sync server runs inside a Docker container on an Always Free `e2-micro` Compute Engine instance. This setup ensures isolated runtime environments, zero dependency conflicts, and automatic container recovery.

---

## 🛠️ Container Architecture on VM

The VM runs two Docker containers connected directly to the host network:

1. **`cloud-sql-proxy`** (`gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.11.0`):
   - Establishes a secure connection to your Cloud SQL PostgreSQL instance (`pos-db-instance`) using the VM service account IAM credentials.
   - Listens on `127.0.0.1:5432` on the VM host.

2. **`sync-api-websocket`** (`sync-api:latest`):
   - The NestJS WebSocket sync server.
   - Runs on the host network (`--network=host`) listening on port `3000`.
   - Connects to the database locally at `postgresql://pos_user@127.0.0.1:5432/pos_db`.

---

## 📋 Standard Maintenance Commands

To run these commands, SSH into the VM:
```bash
gcloud compute ssh pos-sync-websocket-vm --zone us-central1-a --project fresh-sensor-497515-d3
```

### Check Container Status
Verify that both containers are running and healthy:
```bash
sudo docker ps
```

### View Application Logs
Stream live stdout/stderr logs from the WebSocket NestJS application:
```bash
sudo docker logs -f sync-api-websocket
```

### View Database Proxy Logs
Verify that connection requests from the Node app are being forwarded to Cloud SQL successfully:
```bash
sudo docker logs -f cloud-sql-proxy
```

### Re-deploy Latest Code Changes
If you have updated the code and pushed a new container tag to Artifact Registry, redeploy the container on the VM by running:
```bash
# Authenticate docker to Artifact Registry
sudo gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

# Pull the latest image
sudo docker pull us-central1-docker.pkg.dev/fresh-sensor-497515-d3/pos-repo/sync-api:latest

# Remove the old container
sudo docker rm -f sync-api-websocket

# Run the updated container
sudo docker run -d \
  --name sync-api-websocket \
  --restart always \
  --network=host \
  -e PORT=3000 \
  -e DATABASE_URL="postgresql://pos_user:<PASSWORD>@127.0.0.1:5432/pos_db" \
  -e ADMIN_PASSWORD="<ADMIN_PASSWORD>" \
  -e NODE_ENV=production \
  us-central1-docker.pkg.dev/fresh-sensor-497515-d3/pos-repo/sync-api:latest
```

---

> [!TIP]
> Since the VM service account (`vm-pos-sa`) is granted `roles/artifactregistry.reader` and `roles/cloudsql.client` in IAM, you do not need to configure any access keys or passwords inside the VM itself for GCP resources.
