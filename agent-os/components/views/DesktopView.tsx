"use client";

import { NotificationSettings } from "@/components/NotificationSettings";
import { StartServerDialog } from "@/components/DevServers/StartServerDialog";
import { DesktopSidebar } from "./DesktopSidebar";
import { Button } from "@/components/ui/button";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Command,
} from "lucide-react";
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
        activeSessionId={activeSession?.id}
        terminalStatuses={terminalStatuses}
        onSelect={(id) => {
            attachToTerminal(id);
          }}
        onNewTerminal={handleNewTerminal}
        onCloseTerminal={handleCloseTerminal}
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
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPinned ? "Unpin sidebar" : "Pin sidebar"}</p>
              </TooltipContent>
            </Tooltip>

            {activeSession && (
              <div className="flex min-w-0 items-center gap-2.5 border-l border-border pl-3">
                <span className="truncate text-sm font-medium">
                  {activeSession.name}
                </span>
              </div>
            )}
          </div>

          <WorkbenchBar />

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
            <Button
              size="sm"
              className="h-7 font-mono text-[10px] tracking-[0.12em] uppercase"
              onClick={() => handleNewTerminal()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Terminal
            </Button>
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
