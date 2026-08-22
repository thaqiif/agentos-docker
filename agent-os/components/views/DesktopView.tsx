"use client";

import { NewSessionDialog } from "@/components/NewSessionDialog";
import { NotificationSettings } from "@/components/NotificationSettings";
import { StartServerDialog } from "@/components/DevServers/StartServerDialog";
import { DesktopSidebar } from "./DesktopSidebar";
import { Button } from "@/components/ui/button";
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  Copy,
  Check,
  Command,
} from "lucide-react";
import { PaneLayout } from "@/components/PaneLayout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuickSwitcher } from "@/components/QuickSwitcher";
import type { ViewProps } from "./types";
import { fileOpenActions } from "@/stores/fileOpen";
import { useSidebarPinned } from "@/hooks/useSidebarPinned";

export function DesktopView({
  sessions,
  projects,
  sessionStatuses,
  activeSession,
  focusedActiveTab,
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
  openSessionInNewTab,
  handleNewSessionInProject,
  handleOpenTerminal,
  handleSessionCreated,
  handleCreateProject,
  handleStartDevServer,
  handleCreateDevServer,
  startDevServerProject,
  setStartDevServerProjectId,
  renderPane,
}: ViewProps) {
  const { isPinned, togglePin } = useSidebarPinned();

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <DesktopSidebar
        isPinned={isPinned}
        togglePin={togglePin}
        activeSessionId={focusedActiveTab?.sessionId || undefined}
        sessionStatuses={sessionStatuses}
        onSelect={(id) => {
          const session = sessions.find((s) => s.id === id);
          if (session) attachToSession(session);
        }}
        onOpenInTab={(id) => {
          const session = sessions.find((s) => s.id === id);
          if (session) openSessionInNewTab(session);
        }}
        onNewSessionInProject={handleNewSessionInProject}
        onOpenTerminal={handleOpenTerminal}
        onStartDevServer={handleStartDevServer}
        onCreateDevServer={handleCreateDevServer}
      />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Command strip */}
        <header className="border-border flex h-11 items-center justify-between gap-3 border-b pr-2 pl-1">
          <div className="flex min-w-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8"
                  onClick={togglePin}
                >
                  {isPinned ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPinned ? "Unpin sidebar" : "Pin sidebar"}</p>
              </TooltipContent>
            </Tooltip>

            {activeSession && (
              <div className="flex min-w-0 items-center gap-2.5 border-l border-border pl-3">
                <span className="tech-label hidden shrink-0 md:inline">
                  //session
                </span>
                <span className="truncate text-sm font-medium">
                  {activeSession.name}
                </span>
                {activeSession.tmux_name && (
                  <span className="tech-meta hidden shrink-0 lg:inline">
                    tmux {activeSession.tmux_name}
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="tech-meta border-border hover:border-border-strong hover:text-foreground flex shrink-0 items-center gap-1 border px-1.5 py-0.5 transition-colors"
                      onClick={async () => {
                        try {
                          if (navigator.clipboard) {
                            await navigator.clipboard.writeText(
                              activeSession.id
                            );
                          } else {
                            // Fallback for non-HTTPS contexts
                            const textarea = document.createElement("textarea");
                            textarea.value = activeSession.id;
                            textarea.style.position = "fixed";
                            textarea.style.opacity = "0";
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand("copy");
                            document.body.removeChild(textarea);
                          }
                          setCopiedSessionId(true);
                          setTimeout(() => setCopiedSessionId(false), 2000);
                        } catch {
                          console.error("Failed to copy to clipboard");
                        }
                      }}
                    >
                      {copiedSessionId ? (
                        <Check className="text-status-running h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="hidden xl:inline">
                        id {activeSession.id.slice(0, 8)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy session ID for orchestration</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {activeSession.id.slice(0, 8)}...
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowQuickSwitcher(true)}
                  className="border-border text-muted-foreground hover:border-border-strong hover:text-foreground flex h-7 items-center gap-1.5 border px-2 font-mono text-[10px] tracking-[0.1em] transition-colors"
                >
                  <Command className="h-3 w-3" />
                  <span className="hidden sm:inline">⌘K</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quick switch</p>
                <p className="text-muted-foreground text-xs">⌘K</p>
              </TooltipContent>
            </Tooltip>
            <NotificationSettings
              open={showNotificationSettings}
              onOpenChange={setShowNotificationSettings}
              settings={notificationSettings}
              permissionGranted={permissionGranted}
              waitingSessions={sessions
                .filter((s) => sessionStatuses[s.id]?.status === "waiting")
                .map((s) => ({ id: s.id, name: s.name }))}
              onUpdateSettings={updateSettings}
              onRequestPermission={requestPermission}
              onSelectSession={(id) => {
                const session = sessions.find((s) => s.id === id);
                if (session) attachToSession(session);
              }}
            />
            <Button
              size="sm"
              className="h-7 font-mono text-[10px] tracking-[0.12em] uppercase"
              onClick={() => setShowNewSessionDialog(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Session
            </Button>
          </div>
        </header>

        {/* Pane Layout - full height */}
        <div className="min-h-0 flex-1">
          <PaneLayout renderPane={renderPane} />
        </div>
      </div>

      {/* Dialogs */}
      <NewSessionDialog
        open={showNewSessionDialog}
        projects={projects}
        selectedProjectId={newSessionProjectId ?? undefined}
        onClose={() => setShowNewSessionDialog(false)}
        onCreated={handleSessionCreated}
        onCreateProject={handleCreateProject}
      />
      <QuickSwitcher
        sessions={sessions}
        open={showQuickSwitcher}
        onOpenChange={setShowQuickSwitcher}
        currentSessionId={focusedActiveTab?.sessionId ?? undefined}
        activeSessionWorkingDir={activeSession?.working_directory ?? undefined}
        onSelectSession={(sessionId) => {
          const session = sessions.find((s) => s.id === sessionId);
          if (session) attachToSession(session);
        }}
        onSelectFile={(file, line) => {
          // Convert relative path to absolute by prepending working directory
          const absolutePath = activeSession?.working_directory
            ? `${activeSession.working_directory}/${file.replace(/^\.\//, "")}`
            : file;
          fileOpenActions.requestOpen(absolutePath, line);
        }}
      />
      {startDevServerProject && (
        <StartServerDialog
          project={startDevServerProject}
          projectDevServers={startDevServerProject.devServers}
          onStart={handleCreateDevServer}
          onClose={() => setStartDevServerProjectId(null)}
        />
      )}
    </div>
  );
}
