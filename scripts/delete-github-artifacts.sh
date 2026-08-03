#!/bin/bash
# Script to delete all GitHub Actions artifacts for joelms90/Flutter_Cacharelo_Cafeteria

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo "🔑 You are not logged in to GitHub CLI. Starting login flow..."
    gh auth login
fi

REPO="joelms90/Flutter_Cacharelo_Cafeteria"
echo "🔍 Fetching artifacts for $REPO..."

ARTIFACTS=$(gh api repos/$REPO/actions/artifacts --jq '.artifacts[].id' 2>/dev/null)

if [ -z "$ARTIFACTS" ]; then
    echo "✅ No artifacts found for $REPO or query failed."
    exit 0
fi

echo "🗑️ Deleting artifacts..."
for id in $ARTIFACTS; do
    echo "Deleting artifact $id..."
    gh api -X DELETE repos/$REPO/actions/artifacts/$id
done

echo "🎉 All artifacts deleted successfully!"
