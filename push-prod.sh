#!/bin/bash
# Push changes to the production (Live Site) branch with a custom message
echo "--- Deploying to Production ---"
echo "Enter your commit message:"
read msg

if [ -z "$msg" ]; then
    msg="Deploy: $(date +'%Y-%m-%d %H:%M:%S')"
fi

git add .
git commit -m "$msg"
git push origin production
echo "Done. Live site is updating."
