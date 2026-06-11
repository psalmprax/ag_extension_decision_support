#!/usr/bin/env bash
set -e
# Ensure local stage is up‑to‑date
git checkout stage
git pull origin stage
# Push stage to remote
git push origin stage
# Merge stage into master with watermark
git checkout master
# Preserve master history, create merge commit with watermark
git merge --no-ff stage -m "#MERGE Stage To Master"
# Push master
git push origin master
