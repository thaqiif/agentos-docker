"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Debug log buffer - persists even if console is closed
const debugLogs: string[] = [];
const MAX_DEBUG_LOGS = 100;

function debugLog(message: string) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
  const entry = `[${timestamp}] ${message}`;
  debugLogs.push(entry);
  if (debugLogs.length > MAX_DEBUG_LOGS) debugLogs.shift();
  console.log(`[AgentOS] ${message}`);
}

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as unknown as { agentOSLogs: () => void }).agentOSLogs = () => {
    console.log("=== AgentOS Debug Logs ===");
    debugLogs.forEach((log) => console.log(log));
    console.log("=== End Logs ===");
  };
}
import { PaneProvider, usePanes } from "@/contexts/PaneContext";
import { Pane } from "@/components/Pane";
import { useNotifications } from "@/hooks/useNotifications";
import { useViewport } from "@/hooks/useViewport";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useTerminals } from "@/hooks/useTerminals";
import { useProjects } from "@/hooks/useProjects";
import { useDevServersManager } from "@/hooks/useDevServersManager";
import { useTerminalStatuses } from "@/hooks/useTerminalStatuses";
import type { TerminalRecord } from "@/lib/terminals";
import type { TerminalHandle } from "@/components/Terminal";
import { DesktopView } from "@/components/views/DesktopView";
import { MobileView } from "@/components/views/MobileView";

function HomeContent() {
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const terminalRef = useRef<TerminalHandle | null>(null);

  // Pane context
  const { attachedTmux, attach } = usePanes();
  const { isMobile, isHydrated } = useViewport();

  // Data hooks
  const { terminals, fetchTerminals, createTerminal, killTerminal } =
    useTerminals();
  const { projects, fetchProjects } = useProjects();
  const {
    startDevServerProjectId,
    setStartDevServerProjectId,
    startDevServer,
    createDevServer,
  } = useDevServersManager();

  // Set CSS variable for viewport height (handles mobile keyboard)
  useViewportHeight();

  // Terminal ref management. There is exactly one terminal in the
  // workbench now, so this is a single slot rather than a keyed map.
  const registerTerminalRef = useCallback((ref: TerminalHandle | null) => {
    terminalRef.current = ref;
    debugLog(ref ? "Terminal registered" : "Terminal unregistered");
  }, []);

  const getTerminal = useCallback((): TerminalHandle | undefined => {
    if (!terminalRef.current) {
      debugLog("NO TERMINAL AVAILABLE");
      return undefined;
    }
    return terminalRef.current;
  }, []);

  /**
   * Point the workbench at a tmux session.
   *
   * The pty behind the terminal is a plain shell, so "attaching" means
   * running `tmux attach` in it. If it is already inside tmux we detach
   * first (Ctrl-B d) and clear whatever is on the command line, otherwise
   * the attach command would be typed into the running program instead of
   * the shell.
   */
  const attachToTerminal = useCallback(
    (name: string) => {
      const terminal = getTerminal();
      if (!terminal) {
        debugLog(`ERROR: No terminal available to attach: ${name}`);
        return;
      }

      // A terminal whose tmux session has been killed is still listed, so
      // attaching has to be able to start it again. The fallback runs in
      // the shell, which also closes the race where the session dies
      // between the listing and the click.
      const record = terminals.find((t) => t.tmux_name === name);
      const cwd = record?.working_directory || "$HOME";
      const start = `tmux new -s ${name} -c "${cwd}"`;

      const isInTmux = !!attachedTmux;
      if (isInTmux) terminal.sendInput("\x02d");

      setTimeout(
        () => {
          terminal.sendInput("\x03");
          setTimeout(() => {
            // Mouse mode makes tmux's own splits usable in the browser.
            terminal.sendCommand(
              `tmux set -g mouse on 2>/dev/null; tmux attach -t ${name} 2>/dev/null || ${start}`
            );
            attach(name);
            terminal.focus();
            // The restart changes what the listing should say.
            void fetchTerminals();
          }, 50);
        },
        isInTmux ? 100 : 0
      );
    },
    [getTerminal, attachedTmux, attach, terminals, fetchTerminals]
  );

  // The attached tmux session is what the workbench is looking at.
  const activeSession = terminals.find((t) => t.tmux_name === attachedTmux);

  // Notification click handler
  const handleNotificationClick = useCallback(
    (name: string) => attachToTerminal(name),
    [attachToTerminal]
  );

  // Notifications
  const {
    settings: notificationSettings,
    checkStateChanges,
    updateSettings,
    requestPermission,
    permissionGranted,
  } = useNotifications({ onSessionClick: handleNotificationClick });

  // Terminal statuses
  const { terminalStatuses } = useTerminalStatuses({
    terminals,
    activeTerminal: activeSession?.id,
    checkStateChanges,
  });

  // Set initial sidebar state based on viewport (only after hydration)
  useEffect(() => {
    if (isHydrated && !isMobile) setSidebarOpen(true);
  }, [isMobile, isHydrated]);

  // Keyboard shortcut: Cmd+K to open quick switcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectTerminal = useCallback(
    (name: string) => {
      debugLog(`handleSelectTerminal: ${name}`);
      attachToTerminal(name);
    },
    [attachToTerminal]
  );

  // Pane renderer
  const renderPane = useCallback(
    () => (
      <Pane
        terminals={terminals}
        projects={projects}
        onRegisterTerminal={registerTerminalRef}
        onMenuClick={isMobile ? () => setSidebarOpen(true) : undefined}
        onSelectTerminal={handleSelectTerminal}
      />
    ),
    [terminals, projects, registerTerminalRef, isMobile, handleSelectTerminal]
  );

  /**
   * Open a new terminal.
   *
   * It is a plain shell in a working directory — no harness is chosen here.
   * Starting Claude, Codex, OpenCode or Command Code is done by typing its
   * name, and the status detector picks that up from the running process.
   */
  const handleNewTerminal = useCallback(
    async (projectId?: string) => {
      const project = projectId
        ? projects.find((p) => p.id === projectId)
        : undefined;

      const terminal = await createTerminal({
        cwd: project?.working_directory,
        projectId,
      });

      await fetchTerminals();
      setTimeout(() => attachToTerminal(terminal.name), 100);
    },
    [projects, createTerminal, fetchTerminals, attachToTerminal]
  );

  const handleCloseTerminal = useCallback(
    async (name: string) => {
      await killTerminal(name);
      await fetchTerminals();
    },
    [killTerminal, fetchTerminals]
  );

  // Project created handler (shared between desktop/mobile)
  const handleCreateProject = useCallback(
    async (
      name: string,
      workingDirectory: string,
      agentType?: string
    ): Promise<string | null> => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, workingDirectory, agentType }),
      });
      const data = await res.json();
      if (data.project) {
        await fetchProjects();
        return data.project.id;
      }
      return null;
    },
    [fetchProjects]
  );

  const startDevServerProject = startDevServerProjectId
    ? (projects.find((p) => p.id === startDevServerProjectId) ?? null)
    : null;

  // View props
  const viewProps = {
    terminals,
    projects,
    terminalStatuses,
    sidebarOpen,
    setSidebarOpen,
    activeSession: activeSession as TerminalRecord | undefined,
    copiedSessionId,
    setCopiedSessionId,
    showNotificationSettings,
    setShowNotificationSettings,
    showQuickSwitcher,
    setShowQuickSwitcher,
    notificationSettings,
    permissionGranted,
    updateSettings,
    requestPermission,
    attachToTerminal,
    handleNewTerminal,
    handleCloseTerminal,
    handleCreateProject,
    handleStartDevServer: startDevServer,
    handleCreateDevServer: createDevServer,
    startDevServerProject,
    setStartDevServerProjectId,
    renderPane,
  };

  if (isMobile) {
    return <MobileView {...viewProps} />;
  }

  return <DesktopView {...viewProps} />;
}

export default function Home() {
  return (
    <PaneProvider>
      <HomeContent />
    </PaneProvider>
  );
}
