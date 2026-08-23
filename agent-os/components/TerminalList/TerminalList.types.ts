import type { TerminalRecord } from "@/lib/terminals";

export interface SessionStatus {
  sessionName: string;
  status: "idle" | "running" | "waiting" | "done" | "error" | "dead";
  lastLine?: string;
}

export interface TerminalListProps {
  /** tmux session name of the terminal currently attached. */
  activeSessionId?: string;
  /** Keyed by tmux session name. */
  terminalStatuses?: Record<string, SessionStatus>;
  onSelect: (name: string) => void;
  /** Open a new terminal, optionally in a project's working directory. */
  onNewTerminal?: (projectId?: string) => void;
  onCloseTerminal?: (name: string) => void;
  onStartDevServer?: (projectId: string) => void;
  onCreateDevServer?: (opts: {
    projectId: string;
    type: "node" | "docker";
    name: string;
    command: string;
    workingDirectory: string;
    ports?: number[];
  }) => Promise<void>;
  /** Notification bell element, rendered into the sidebar header. */
  notifications?: React.ReactNode;
  onQuickSwitch?: () => void;
}

export interface SessionHoverHandlers {
  onHoverStart: (terminal: TerminalRecord, rect: DOMRect) => void;
  onHoverEnd: () => void;
}
