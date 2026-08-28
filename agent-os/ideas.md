# Agent-OS Future Ideas

## Features

- [ ] MCP server integration - Toggle AI capabilities (web search, GitHub) per terminal
- [ ] Terminal templates - Pre-configured terminals for common tasks
- [ ] Terminal groups - Organize terminals into projects/folders
- [ ] Terminal search - Fuzzy search across all conversations
- [ ] Export conversations - Export to Markdown/JSON
- [ ] Keyboard shortcuts - Quick navigation and actions
- [x] Mobile responsive - Better mobile layout
- [ ] Dark/light theme toggle

## Technical

- [ ] Message streaming improvements - Better partial message handling
- [ ] Tool call persistence - Store tool calls in database
- [ ] Terminal snapshots - Save/restore terminal state
- [ ] Multiple working directories per terminal
- [ ] Claude model selection per terminal
- [ ] Rate limiting / queue for parallel terminals
- [ ] WebSocket reconnection handling
- [ ] Terminal auto-save/recovery

## Workspaces (inspired by catnip)

- [ ] Project-tied workspaces - Terminals grouped by project, not just folders
- [ ] Auto dev server management - Each worktree gets its own dev server with unique port
- [ ] Parallel development environments - Run multiple features simultaneously with isolated servers
- [ ] Workspace dashboard - See all active worktrees, their branches, ports, and terminal status
- [ ] One-click environment spin-up - Create worktree + terminal + dev server in single action
- [ ] Port forwarding UI - View/manage all running dev servers across worktrees
- [ ] Worktree health monitoring - Track build status, test results per environment

## Integration

- [ ] tmux terminal linking - Attach Claude to existing tmux terminals
- [ ] Git integration - Show repo status in terminal header
- [ ] File browser - Browse working directory
- [ ] Image/file upload support
- [ ] Voice input/output
