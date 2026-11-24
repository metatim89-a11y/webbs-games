#!/bin/bash
# Build and upload the database rules (needs gcloud signed in to the x300-506418 project).
set -e
cd "$(dirname "$0")"
python3 build-rules.py
TOKEN=$(gcloud auth print-access-token)
curl -sf -X PUT "https://x300-506418-default-rtdb.firebaseio.com/.settings/rules.json?access_token=$TOKEN" \
  --data-binary @database.rules.json
echo
echo "Rules deployed."
