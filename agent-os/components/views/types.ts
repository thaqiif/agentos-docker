import type { TerminalRecord } from "@/lib/terminals";
import type { ProjectWithDevServers } from "@/lib/projects";
import type { NotificationSettings } from "@/lib/notifications";

export interface SessionStatus {
  sessionName: string;
  status: "idle" | "running" | "waiting" | "done" | "error" | "dead";
  lastLine?: string;
}

export interface ViewProps {
  terminals: TerminalRecord[];
  projects: ProjectWithDevServers[];
  /** Keyed by tmux session name. */
  terminalStatuses: Record<string, SessionStatus>;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeSession: TerminalRecord | undefined;
  copiedSessionId: boolean;
  setCopiedSessionId: (copied: boolean) => void;

  // Dialogs
  showNotificationSettings: boolean;
  setShowNotificationSettings: (show: boolean) => void;
  showQuickSwitcher: boolean;
  setShowQuickSwitcher: (show: boolean) => void;

  // Notification settings
  notificationSettings: NotificationSettings;
  permissionGranted: boolean;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  requestPermission: () => Promise<boolean>;

  // Handlers
  attachToTerminal: (name: string) => void;
  /** Open a new terminal, optionally in a project's working directory. */
  handleNewTerminal: (projectId?: string) => Promise<void>;
  handleCloseTerminal: (name: string) => Promise<void>;
  handleCreateProject: (
    name: string,
    workingDirectory: string,
    agentType?: string
  ) => Promise<string | null>;

  // Dev server (for StartServerDialog)
  handleStartDevServer: (projectId: string) => void;
  handleCreateDevServer: (opts: {
    projectId: string;
    type: "node" | "docker";
    name: string;
    command: string;
    workingDirectory: string;
    ports?: number[];
  }) => Promise<void>;
  startDevServerProject: ProjectWithDevServers | null;
  setStartDevServerProjectId: (id: string | null) => void;

  // Pane
  renderPane: () => React.ReactNode;
}
