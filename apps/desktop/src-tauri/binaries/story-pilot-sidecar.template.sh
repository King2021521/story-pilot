#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STORY_PILOT_REPO_ROOT:-}" ]]; then
  echo "STORY_PILOT_REPO_ROOT is required to launch the Story Pilot sidecar." >&2
  exit 1
fi

cd "$STORY_PILOT_REPO_ROOT"

find_node() {
  if [[ -n "${STORY_PILOT_NODE:-}" && -x "${STORY_PILOT_NODE}" ]]; then
    printf '%s\n' "${STORY_PILOT_NODE}"
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local candidates=(
    "/opt/homebrew/bin/node"
    "/usr/local/bin/node"
  )
  local candidate
  for candidate in "${candidates[@]}" "$HOME"/.nvm/versions/node/*/bin/node; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if [[ -f "apps/sidecar/dist/main.js" ]]; then
  NODE_BIN="$(find_node)" || {
    echo "Story Pilot sidecar requires node, but no executable node binary was found." >&2
    exit 127
  }
  exec "$NODE_BIN" "apps/sidecar/dist/main.js"
fi

exec pnpm --filter "@story-pilot/sidecar" dev
