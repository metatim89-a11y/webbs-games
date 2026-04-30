#!/bin/bash
# Push changes to both Master and Production branches with a custom message and version bump

if [ -z "$1" ]; then
    echo "Usage: ./push-all.sh <version_number> \"<commit_message>\""
    echo "Example: ./push-all.sh 1.1.2 \"Update game logic\""
    exit 1
fi

NEW_VER=$1
MSG=$2

if [ -z "$MSG" ]; then
    MSG="Update: $(date +'%Y-%m-%d %H:%M:%S')"
fi

echo "--- 1. Bumping Version to v$NEW_VER ---"
./version-update.sh $NEW_VER

echo "--- 2. Committing Changes ---"
git add .
git commit -m "$MSG (v$NEW_VER)"

echo "--- 3. Pushing to Production ---"
git push origin production

echo "--- 4. Syncing to Master ---"
git checkout master
git merge production
git push origin master

echo "--- 5. Returning to Production ---"
git checkout production

echo "--- Done. Changes pushed to Master and Production. ---"
