#!/bin/bash

# Check if a version number was provided
if [ -z "$1" ]; then
    echo "Usage: ./version-update.sh <version_number>"
    echo "Example: ./version-update.sh 1.1.1"
    exit 1
fi

NEW_VER=$1
echo "Updating project to version v$NEW_VER..."

# 1. Update the visible version tag in HTML files
# Looks for <div id="version-tag">v...</div>
find . -name "*.html" -exec sed -i "s|<div id=\"version-tag\">v[0-9.]*</div>|<div id=\"version-tag\">v$NEW_VER</div>|g" {} +

# 2. Update CSS links with cache busting
# Looks for href="...style.css?v=..." or href="...style.css"
find . -name "*.html" -exec sed -i "s|style.css\([?v=0-9.]*\)\?|style.css?v=$NEW_VER|g" {} +

# 3. Update JS imports with cache busting
# Looks for src="...js?v=..." or src="...js" (excluding external unpkg links)
find . -name "*.html" -exec sed -i "/unpkg.com/! s|\.js\([?v=0-9.]*\)\?|.js?v=$NEW_VER|g" {} +

echo "Done! All files updated to v$NEW_VER."
