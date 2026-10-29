#!/usr/bin/env bash
# One commit with no history to this repository's main branch, of everything in
# the folder given: what the app reads. Both jobs of .github/workflows/prices.yml
# publish this way, the main one first and Shufersal's after it, on top of what
# the main one put there. The build code lives on the build branch and is never
# touched by this.
#   PUSH_TOKEN=... scripts/prices-publish.sh out
set -e
dir="$1"
[ -n "$PUSH_TOKEN" ] || { echo "PUSH_TOKEN is not set; nothing published"; exit 0; }
[ "$(ls "$dir" 2>/dev/null | wc -l)" -gt 1 ] || { echo "nothing priced, keeping yesterday's"; exit 0; }
cd "$dir"
rm -rf .git
git init -q -b main
git config user.name "basket-prices"
git config user.email "actions@users.noreply.github.com"
git add .
git commit -q -m "basket prices $(date -u +%F)"
# The token goes in a header, not the URL, so it never shows in an error message.
auth=$(printf 'x-access-token:%s' "$PUSH_TOKEN" | base64 -w0)
git -c http.extraHeader="Authorization: Basic $auth" push -q -f "https://github.com/${GITHUB_REPOSITORY:-idoravid15-art/homi-prices}.git" main
echo "published $(ls | wc -l) files"
