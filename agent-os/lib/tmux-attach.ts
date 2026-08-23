/**
 * Single-quote a value for the shell.
 *
 * Session names are user-chosen and working directories are arbitrary
 * paths, so both can contain spaces — an unquoted `tmux attach -t my name`
 * is parsed as two arguments and fails with "too many arguments", after
 * which the fallback happily creates a *new* session called `my`.
 */
function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The command the workbench types into its shell to attach to a session.
 *
 * The pty behind the terminal is a plain shell, so "attaching" is literally
 * running `tmux attach` in it. Two callers need the exact same string — the
 * sidebar click and the terminal's own connect handler — so it lives here.
 *
 * A terminal whose tmux session has been killed is still listed, hence the
 * fallback: if the attach fails the session is created again in the same
 * working directory. That also closes the race where a session dies between
 * the listing and the click.
 */
export function tmuxAttachCommand(name: string, cwd?: string | null): string {
  const target = quote(name);
  // `$HOME` has to stay unquoted for the shell to expand it.
  const dir = cwd ? quote(cwd) : "$HOME";

  // `-g` writes the server's global options, so this covers whatever the
  // attach lands on, including a server these commands just started. Mouse
  // mode makes tmux's own splits usable in the browser; the status bar is
  // redundant here, since the workbench already says which session this is.
  // Both are quiet when there is no server yet — the fallback repeats them.
  const options =
    "tmux set -g mouse on 2>/dev/null; tmux set -g status off 2>/dev/null";

  const create = `tmux new-session -d -s ${target} -c ${dir} 2>/dev/null`;

  return (
    `${options}; tmux attach -t ${target} 2>/dev/null || ` +
    `{ ${create}; ${options}; tmux attach -t ${target}; }`
  );
}
