#!/usr/bin/env bash
# Extract the CHANGELOG.md section for a given version.
#
# Usage: script/extract-release-notes.sh <version>
# Example: script/extract-release-notes.sh 1.0.0
#
# Matches a heading of the form:
#   ## [1.0.0]
#   ## v1.0.0
#   ## 1.0.0
# and emits the body of that section up to the next `## ` heading.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version>" >&2
  exit 2
fi

version="$1"
changelog="${CHANGELOG:-CHANGELOG.md}"

if [[ ! -f "$changelog" ]]; then
  echo "Changelog file '$changelog' not found." >&2
  exit 1
fi

awk -v ver="$version" '
  BEGIN { in_section = 0 }
  /^## / {
    if (in_section) { exit }
    if ($0 ~ "^## \\[?v?" ver "\\]?([ \t].*)?$") {
      in_section = 1
      next
    }
  }
  in_section { print }
' "$changelog"
