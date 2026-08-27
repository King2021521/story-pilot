#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STORY_PILOT_REPO_ROOT:-}" ]]; then
  echo "STORY_PILOT_REPO_ROOT is required to launch the Story Pilot sidecar." >&2
  exit 1
fi

cd "$STORY_PILOT_REPO_ROOT"

if [[ -f "apps/sidecar/dist/main.js" ]]; then
  exec node "apps/sidecar/dist/main.js"
fi

exec pnpm --filter "@story-pilot/sidecar" dev
