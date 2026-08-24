"use client";

import { NotificationSettings } from "@/components/NotificationSettings";
import { StartServerDialog } from "@/components/DevServers/StartServerDialog";
import { DesktopSidebar } from "./DesktopSidebar";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { WorkbenchBar } from "./WorkbenchBar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QuickSwitcher } from "@/components/QuickSwitcher";
import type { ViewProps } from "./types";
import { fileOpenActions } from "@/stores/fileOpen";
import { useSidebarPinned } from "@/hooks/useSidebarPinned";
import { useTerminalRename } from "@/hooks/useTerminalRename";
import { WorkbenchTitle } from "./WorkbenchTitle";

export function DesktopView({
  terminals,
  projects,
  terminalStatuses,
  activeSession,
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
  handleDetachTerminal,
  handleCreateProject,
  handleStartDevServer,
  handleCreateDevServer,
  startDevServerProject,
  setStartDevServerProjectId,
  renderPane,
}: ViewProps) {
  const { isPinned, togglePin } = useSidebarPinned();
  const renameTerminal = useTerminalRename();

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <DesktopSidebar
        isPinned={isPinned}
        activeSessionId={activeSession?.id}
        terminalStatuses={terminalStatuses}
        onSelect={(id) => {
          attachToTerminal(id);
        }}
        onNewTerminal={handleNewTerminal}
        onCloseTerminal={handleCloseTerminal}
        onStartDevServer={handleStartDevServer}
        onCreateDevServer={handleCreateDevServer}
        onQuickSwitch={() => setShowQuickSwitcher(true)}
        notifications={
          <NotificationSettings
            open={showNotificationSettings}
            onOpenChange={setShowNotificationSettings}
            settings={notificationSettings}
            permissionGranted={permissionGranted}
            waitingSessions={terminals
              .filter((t) => {
                // Anything wanting attention: blocked on input, or
                // finished and not looked at yet.
                const status = terminalStatuses[t.id]?.status;
                return status === "waiting" || status === "done";
              })
              .map((t) => ({ id: t.id, name: t.name }))}
            onUpdateSettings={updateSettings}
            onRequestPermission={requestPermission}
            onSelectSession={(id) => attachToTerminal(id)}
          />
        }
      />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Command strip. The left is identity — sidebar toggle and what is
            attached — and the view controls own the right. */}
        <header className="border-border flex h-12 items-center justify-between gap-3 border-b px-2">
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
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle sidebar</p>
              </TooltipContent>
            </Tooltip>

            {activeSession && (
              <div className="flex min-w-0 items-center gap-1 border-l border-border pl-3">
                <WorkbenchTitle
                  name={activeSession.name}
                  onRename={renameTerminal}
                />
                {/* Detach, not kill: the session and everything in it keep
                    running, the workbench just stops looking at it. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 shrink-0"
                      onClick={handleDetachTerminal}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close terminal</p>
                    <p className="text-muted-foreground text-xs">
                      Keeps it running in tmux
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <WorkbenchBar />
          </div>
        </header>

        {/* Single terminal surface - full height */}
        <div className="min-h-0 flex-1">{renderPane()}</div>
      </div>

      {/* Dialogs */}
      <QuickSwitcher
        terminals={terminals}
        open={showQuickSwitcher}
        onOpenChange={setShowQuickSwitcher}
        currentSessionId={activeSession?.id}
        activeSessionWorkingDir={activeSession?.working_directory ?? undefined}
        onSelectSession={(name) => attachToTerminal(name)}
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
