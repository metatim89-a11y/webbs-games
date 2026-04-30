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
find . -name "*.html" -exec sed -i "s|<div id=\"version-tag\">v[0-9.]*</div>|<div id=\"version-tag\">v$NEW_VER</div>|g" {} +

# 2. Update CSS links with cache busting (Strictly target href)
find . -name "*.html" -exec sed -i "s|href=\"\([^\"]*\)style.css[^\"]*\"|href=\"\1style.css?v=$NEW_VER\"|g" {} +

# 3. Update JS imports with cache busting (Strictly target src, avoid unpkg)
find . -name "*.html" -exec sed -i "/unpkg.com/! s|src=\"\([^\"]*\)\.js[^\"]*\"|src=\"\1.js?v=$NEW_VER\"|g" {} +

echo "Done! All files updated to v$NEW_VER."
