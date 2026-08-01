#!/bin/bash

# Script to generate/update version metadata for POS Flutter releases
# This script is called by GitHub Actions workflows after successful builds

set -e

PLATFORM=$1
VERSION=$2
DOWNLOAD_URL=$3
SIZE=$4
COMMIT_SHA=$5
BRANCH=$6

# Use current working directory for temp files to avoid path issues on Windows
METADATA_TEMP="./metadata-temp.json"
METADATA_UPDATED="./metadata-updated.json"

echo "Working directory: $(pwd)"
echo "Metadata temp file: $METADATA_TEMP"
echo "Metadata updated file: $METADATA_UPDATED"

# If metadata file doesn't exist in Cloud Storage, create initial structure
if ! gcloud storage cat gs://cacharelo-pos-releases/metadata.json > "$METADATA_TEMP" 2>/dev/null; then
  echo "Creating new metadata.json"
  cat > "$METADATA_TEMP" <<'EOF'
{
  "lastUpdated": "",
  "currentVersion": "1.0.0",
  "platforms": {}
}
EOF
fi

echo "Metadata file downloaded/created successfully"
ls -lh "$METADATA_TEMP" 2>/dev/null || dir "$METADATA_TEMP" 2>/dev/null || echo "File check failed"

# Update the specific platform section using jq
echo "Updating metadata with jq..."
jq --arg platform "$PLATFORM" \
   --arg version "$VERSION" \
   --arg url "$DOWNLOAD_URL" \
   --arg size "$SIZE" \
   --arg commit "$COMMIT_SHA" \
   --arg branch "$BRANCH" \
   --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || powershell -Command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'" 2>/dev/null || echo "2024-01-01T00:00:00Z")" \
   '.lastUpdated = $timestamp |
    .currentVersion = $version |
    .platforms[$platform] = {
      "version": $version,
      "downloadUrl": $url,
      "size": $size,
      "commit": $commit,
      "branch": $branch,
      "buildDate": $timestamp
    }' "$METADATA_TEMP" > "$METADATA_UPDATED"

echo "Metadata updated successfully"
ls -lh "$METADATA_UPDATED" 2>/dev/null || dir "$METADATA_UPDATED" 2>/dev/null || echo "Updated file check failed"

echo "Uploading metadata to Cloud Storage..."

# Verify the file exists before uploading
if [[ ! -f "$METADATA_UPDATED" ]]; then
  echo "❌ Error: Updated metadata file not found at: $METADATA_UPDATED"
  echo "Checking if file exists in current directory..."
  ls -la metadata*.json 2>/dev/null || dir metadata*.json 2>/dev/null || echo "No metadata files found"
  exit 1
fi

# Upload updated metadata - use quotes to handle paths with spaces
if gcloud storage cp "$METADATA_UPDATED" gs://cacharelo-pos-releases/metadata.json \
  --cache-control="no-cache" \
  --content-type="application/json"; then
  echo "✅ Successfully uploaded metadata.json"
else
  echo "❌ Failed to upload metadata.json"
  echo "File info:"
  ls -lh "$METADATA_UPDATED" 2>/dev/null || dir "$METADATA_UPDATED" 2>/dev/null || echo "Could not stat file"
  echo "File contents:"
  cat "$METADATA_UPDATED" 2>/dev/null || type "$METADATA_UPDATED" 2>/dev/null || echo "Could not read file"
  exit 1
fi

# Try to set public read ACL (non-fatal if it fails)
echo "Attempting to set public read permissions..."
if gcloud storage objects update gs://cacharelo-pos-releases/metadata.json \
  --add-acl-grant=entity=allUsers,role=READER 2>/dev/null; then
  echo "✅ Public read permissions set successfully"
elif gsutil acl ch -u AllUsers:R gs://cacharelo-pos-releases/metadata.json 2>/dev/null; then
  echo "✅ Public read permissions set successfully (via gsutil)"
else
  echo "⚠️  Could not set public ACL (may already be public at bucket level)"
fi

echo ""
echo "✅ Metadata updated for platform: $PLATFORM"
echo "📦 Version: $VERSION"
echo "🔗 URL: $DOWNLOAD_URL"

# Cleanup temp files (important for local runs, GitHub Actions cleans workspace anyway)
echo "Cleaning up temporary files..."
rm -f "$METADATA_TEMP" "$METADATA_UPDATED" 2>/dev/null || true
echo "✅ Cleanup complete"
