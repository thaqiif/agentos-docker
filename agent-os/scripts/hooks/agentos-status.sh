#!/usr/bin/env bash
# Report a terminal's state to AgentOS.
#
# Usage: agentos-status.sh <running|waiting|done|idle> [source]
#
# The status detector's fallback is to read the tmux pane and infer state
# from what the TUI happens to be drawing. That works, but it depends on
# chrome, terminal width and redraw timing, which is why it was flaky. A
# harness that supports hooks can just say what it is doing, and this script
# is where it says it.
#
# State is keyed by tmux session name because that is a terminal's identity
# in AgentOS. Outside tmux there is nothing to report against, so we exit
# quietly rather than writing a file nothing will ever read.

set -u

state="${1:-}"
source_name="${2:-hook}"

case "$state" in
  running|waiting|done|idle) ;;
  *) exit 0 ;;
esac

command -v tmux >/dev/null 2>&1 || exit 0
[ -n "${TMUX:-}" ] || exit 0

session="$(tmux display-message -p '#{session_name}' 2>/dev/null)" || exit 0
[ -n "$session" ] || exit 0

dir="${AGENTOS_STATUS_DIR:-$HOME/.agent-os/status}"
mkdir -p "$dir" 2>/dev/null || exit 0

# Session names are tmux-legal but not necessarily filename-legal.
safe="$(printf '%s' "$session" | tr -c 'A-Za-z0-9._-' '_')"
target="$dir/$safe.json"
tmp="$target.$$"

printf '{"session":"%s","state":"%s","source":"%s","at":%s}\n' \
  "$session" "$state" "$source_name" "$(date +%s%3N)" > "$tmp" 2>/dev/null || exit 0

# Atomic replace: the reader must never see a half-written file.
mv -f "$tmp" "$target" 2>/dev/null || rm -f "$tmp"
exit 0
