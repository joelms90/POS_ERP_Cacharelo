#!/bin/bash

# One-time setup script to configure the Cloud Storage bucket for public access
# Run this manually once: bash .github/scripts/setup-bucket-public-access.sh

BUCKET_NAME="cacharelo-pos-releases"

echo "🔧 Configuring public access for gs://$BUCKET_NAME"

# Make the entire bucket publicly readable
echo "Setting bucket-level public read access..."
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

# Set CORS policy to allow web app to fetch metadata.json
echo "Setting CORS policy..."
cat > /tmp/cors.json <<EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set /tmp/cors.json gs://$BUCKET_NAME
rm /tmp/cors.json

# Verify the configuration
echo ""
echo "✅ Configuration complete!"
echo ""
echo "Verifying..."
gsutil iam get gs://$BUCKET_NAME | grep allUsers
echo ""
echo "Testing public access to metadata.json..."
curl -I https://storage.googleapis.com/$BUCKET_NAME/metadata.json 2>&1 | head -5

echo ""
echo "🎉 Setup complete! The bucket is now publicly readable."
