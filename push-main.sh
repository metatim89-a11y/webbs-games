#!/bin/bash
# Push changes to the main (Development) branch with a custom message
echo "--- Pushing to Main ---"
echo "Enter your commit message:"
read msg

if [ -z "$msg" ]; then
    msg="Update: $(date +'%Y-%m-%d %H:%M:%S')"
fi

git add .
git commit -m "$msg"
git push origin main
echo "Done. Changes saved to main."
