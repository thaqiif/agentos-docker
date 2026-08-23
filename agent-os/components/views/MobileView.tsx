"use client";

import { TerminalList } from "@/components/TerminalList";
import { StartServerDialog } from "@/components/DevServers/StartServerDialog";
import { SidebarFooter } from "@/components/SidebarFooter";
import { SwipeSidebar } from "@/components/mobile/SwipeSidebar";
import { QuickSwitcher } from "@/components/QuickSwitcher";
import type { ViewProps } from "./types";
import { fileOpenActions } from "@/stores/fileOpen";

export function MobileView({
  terminals,
  projects,
  terminalStatuses,
  sidebarOpen,
  setSidebarOpen,
  activeSession,
  showQuickSwitcher,
  setShowQuickSwitcher,
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
  return (
    <main className="bg-background flex h-app flex-col overflow-hidden">
      {/* Swipe sidebar */}
      <SwipeSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <div className="flex h-full flex-col">
          {/* Session list */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <TerminalList
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
          </div>

          <SidebarFooter />
        </div>
      </SwipeSidebar>

      {/* Terminal fills the screen */}
      <div className="min-h-0 w-full flex-1">
        {renderPane()}
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
    </main>
  );
}
