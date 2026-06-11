#!/usr/bin/env bash
set -e
BASE_COMMIT="83ddabc3164a46e4b2bf5e38aa5719bb7b408497"
# List commits after base SHA
git log --oneline "$BASE_COMMIT..HEAD"
