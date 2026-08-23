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
import { useSessions } from "@/hooks/useSessions";
import { useProjects } from "@/hooks/useProjects";
import { useDevServersManager } from "@/hooks/useDevServersManager";
import { useSessionStatuses } from "@/hooks/useSessionStatuses";
import type { Session } from "@/lib/db";
import type { TerminalHandle } from "@/components/Terminal";
import { getProvider } from "@/lib/providers";
import { DesktopView } from "@/components/views/DesktopView";
import { MobileView } from "@/components/views/MobileView";
import { getPendingPrompt, clearPendingPrompt } from "@/stores/initialPrompt";

function HomeContent() {
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [newSessionProjectId, setNewSessionProjectId] = useState<string | null>(
    null
  );
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const terminalRef = useRef<TerminalHandle | null>(null);

  // Pane context
  const { attachedTmux, attach } = usePanes();
  const { isMobile, isHydrated } = useViewport();

  // Data hooks
  const { sessions, fetchSessions } = useSessions();
  const { projects, fetchProjects } = useProjects();
  const {
    startDevServerProjectId,
    setStartDevServerProjectId,
    startDevServer,
    createDevServer,
  } = useDevServersManager();

  // Helper to get init script command from API
  const getInitScriptCommand = useCallback(
    async (agentCommand: string): Promise<string> => {
      try {
        const res = await fetch("/api/sessions/init-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentCommand }),
        });
        const data = await res.json();
        return data.command || agentCommand;
      } catch {
        return agentCommand;
      }
    },
    []
  );

  // Set CSS variable for viewport height (handles mobile keyboard)
  useViewportHeight();

  // Terminal ref management. There is exactly one terminal in the
  // workbench now, so this is a single slot rather than a keyed map.
  const registerTerminalRef = useCallback((ref: TerminalHandle | null) => {
    terminalRef.current = ref;
    debugLog(ref ? "Terminal registered" : "Terminal unregistered");
  }, []);

  // The workbench has a single terminal, so there is nothing to search.
  const getTerminal = useCallback((): TerminalHandle | undefined => {
    if (!terminalRef.current) {
      debugLog("NO TERMINAL AVAILABLE");
      return undefined;
    }
    return terminalRef.current;
  }, []);

  // Build tmux command for a session
  const buildSessionCommand = useCallback(
    async (
      session: Session
    ): Promise<{ sessionName: string; cwd: string; command: string }> => {
      const provider = getProvider(session.agent_type || "claude");
      const sessionName = session.tmux_name || `${provider.id}-${session.id}`;
      const cwd = session.working_directory?.replace("~", "$HOME") || "$HOME";

      // Shell sessions just open a terminal - no agent command
      if (provider.id === "shell") {
        return { sessionName, cwd, command: "" };
      }

      // TODO: Add explicit "Enable Orchestration" toggle that creates .mcp.json
      // for conductor sessions. Removed auto-creation because it pollutes projects
      // with .mcp.json files that aren't in their .gitignore.
      // See: /api/sessions/[id]/mcp-config, lib/mcp-config.ts

      // Get parent session ID for forking
      let parentSessionId: string | null = null;
      if (!session.claude_session_id && session.parent_session_id) {
        const parentSession = sessions.find(
          (s) => s.id === session.parent_session_id
        );
        parentSessionId = parentSession?.claude_session_id || null;
      }

      // Check for pending initial prompt
      const initialPrompt = getPendingPrompt(session.id);
      if (initialPrompt) {
        clearPendingPrompt(session.id);
      }

      const flags = provider.buildFlags({
        sessionId: session.claude_session_id,
        parentSessionId,
        autoApprove: session.auto_approve,
        model: session.model,
        initialPrompt: initialPrompt || undefined,
      });
      const flagsStr = flags.join(" ");

      const agentCmd = `${provider.command} ${flagsStr}`;
      const command = await getInitScriptCommand(agentCmd);

      return { sessionName, cwd, command };
    },
    [sessions, getInitScriptCommand]
  );

  // Attach a session to the terminal
  const runSessionInTerminal = useCallback(
    (
      terminal: TerminalHandle,
      sessionInfo: { sessionName: string; cwd: string; command: string }
    ) => {
      const { sessionName, cwd, command } = sessionInfo;
      const tmuxNew = command
        ? `tmux new -s ${sessionName} -c "${cwd}" "${command}"`
        : `tmux new -s ${sessionName} -c "${cwd}"`;
      terminal.sendCommand(
        `tmux set -g mouse on 2>/dev/null; tmux attach -t ${sessionName} 2>/dev/null || ${tmuxNew}`
      );
      attach(sessionName);
      terminal.focus();
    },
    [attach]
  );

  // Attach a terminal to the workbench view.
  //
  // The pty is a plain shell. If it is already inside tmux we detach first
  // (Ctrl-B d) and interrupt whatever is on the command line, then attach
  // to the requested session — creating it if it does not exist yet.
  const attachToSession = useCallback(
    async (session: Session) => {
      const terminal = getTerminal();
      if (!terminal) {
        debugLog(
          `ERROR: No terminal available to attach session: ${session.name}`
        );
        return;
      }

      const isInTmux = !!attachedTmux;

      if (isInTmux) {
        terminal.sendInput("\x02d");
      }

      setTimeout(
        () => {
          terminal.sendInput("\x03");
          setTimeout(async () => {
            const sessionInfo = await buildSessionCommand(session);
            runSessionInTerminal(terminal, sessionInfo);
          }, 50);
        },
        isInTmux ? 100 : 0
      );
    },
    [getTerminal, attachedTmux, buildSessionCommand, runSessionInTerminal]
  );

  // Notification click handler
  const handleNotificationClick = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        attachToSession(session);
      }
    },
    [sessions, attachToSession]
  );

  // Notifications
  const {
    settings: notificationSettings,
    checkStateChanges,
    updateSettings,
    requestPermission,
    permissionGranted,
  } = useNotifications({ onSessionClick: handleNotificationClick });

  // The attached tmux session is what the workbench is looking at.
  const activeSession = sessions.find((s) => s.tmux_name === attachedTmux);

  // Session statuses
  const { sessionStatuses } = useSessionStatuses({
    sessions,
    activeSessionId: activeSession?.id,
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

  // Session selection handler
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      debugLog(`handleSelectSession called for: ${sessionId}`);
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        debugLog(`Found session: ${session.name}, calling attachToSession`);
        attachToSession(session);
      } else {
        debugLog(
          `Session not found in sessions array (length: ${sessions.length})`
        );
      }
    },
    [sessions, attachToSession]
  );

  // Pane renderer
  const renderPane = useCallback(
    () => (
      <Pane
        sessions={sessions}
        projects={projects}
        onRegisterTerminal={registerTerminalRef}
        onMenuClick={isMobile ? () => setSidebarOpen(true) : undefined}
        onSelectSession={handleSelectSession}
      />
    ),
    [sessions, projects, registerTerminalRef, isMobile, handleSelectSession]
  );

  // New session in project handler
  const handleNewSessionInProject = useCallback((projectId: string) => {
    setNewSessionProjectId(projectId);
    setShowNewSessionDialog(true);
  }, []);

  // Session created handler (shared between desktop/mobile)
  const handleSessionCreated = useCallback(
    async (sessionId: string) => {
      setShowNewSessionDialog(false);
      setNewSessionProjectId(null);
      await fetchSessions();

      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      if (!data.session) return;

      setTimeout(() => attachToSession(data.session), 100);
    },
    [fetchSessions, attachToSession]
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

  // Open terminal in project handler (shell session, not AI agent)
  const handleOpenTerminal = useCallback(
    async (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      // Create a shell session with the project's working directory
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${project.name} Terminal`,
          workingDirectory: project.working_directory || "~",
          agentType: "shell",
          projectId,
        }),
      });

      const data = await res.json();
      if (!data.session) return;

      await fetchSessions();

      // Small delay to ensure state updates, then attach
      setTimeout(() => {
        attachToSession(data.session);
      }, 100);
    },
    [projects, fetchSessions, attachToSession]
  );

  const startDevServerProject = startDevServerProjectId
    ? (projects.find((p) => p.id === startDevServerProjectId) ?? null)
    : null;

  // View props
  const viewProps = {
    sessions,
    projects,
    sessionStatuses,
    sidebarOpen,
    setSidebarOpen,
    activeSession,
    copiedSessionId,
    setCopiedSessionId,
    showNewSessionDialog,
    setShowNewSessionDialog,
    newSessionProjectId,
    showNotificationSettings,
    setShowNotificationSettings,
    showQuickSwitcher,
    setShowQuickSwitcher,
    notificationSettings,
    permissionGranted,
    updateSettings,
    requestPermission,
    attachToSession,
    handleNewSessionInProject,
    handleOpenTerminal,
    handleSessionCreated,
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
