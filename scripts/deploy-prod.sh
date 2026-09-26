#!/usr/bin/env bash
# Builds the site for production and uploads it to the storage static website behind anaviche.ch.
# Needs the Azure CLI, signed in with access to the anavicheagstorage account.
set -euo pipefail

STORAGE_ACCOUNT=anavicheagstorage
export VITE_API_BASE=https://anaviche-functions-c0hyakb2hsdyetdc.francecentral-01.azurewebsites.net/api/gateway
unset VITE_AUTH_DISABLED  # production requires login

cd "$(dirname "$0")/.."
rm -rf dist
npm ci
npm run build

conn=$(az storage account show-connection-string -n "$STORAGE_ACCOUNT" --query connectionString -o tsv)
old_assets=$(az storage blob list --connection-string "$conn" -c '$web' --prefix assets/ --query "[].name" -o tsv)

# Hashed assets first, then index.html, so the new page never references missing files.
az storage blob upload-batch --connection-string "$conn" -d '$web' -s dist/assets --destination-path assets \
  --content-cache-control "public, max-age=31536000, immutable" --overwrite -o none
az storage blob upload --connection-string "$conn" -c '$web' -n index.html -f dist/index.html \
  --content-type "text/html; charset=utf-8" --content-cache-control "no-cache" --overwrite -o none

# Remove assets from earlier builds.
for name in $old_assets; do
  [ -e "dist/$name" ] || az storage blob delete --connection-string "$conn" -c '$web' -n "$name" -o none
done

# Unknown paths (/manage, /accounting, ...) serve the app, which routes them.
az storage blob service-properties update --connection-string "$conn" --static-website \
  --index-document index.html --404-document index.html -o none

echo "Deployed to https://www.anaviche.ch"
