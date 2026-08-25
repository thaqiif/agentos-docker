#!/usr/bin/env bash
# Codex `notify` handler.
#
# Codex passes one JSON argument and supports exactly one event type,
# agent-turn-complete, with no approval or turn-start event. So Codex can
# tell us precisely when it has finished, and nothing else — "running" and
# "waiting" still come from the pane reader.

set -u

payload="${1:-}"
case "$payload" in
  *'"agent-turn-complete"'*) ;;
  *) exit 0 ;;
esac

exec "$(dirname "$0")/agentos-status.sh" done codex
