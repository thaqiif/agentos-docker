"use client";

import { useRef, useCallback, useEffect, memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePanes } from "@/contexts/PaneContext";
import { useViewport } from "@/hooks/useViewport";
import type { TerminalHandle } from "@/components/Terminal";
import type { Project } from "@/lib/db";
import type { TerminalRecord } from "@/lib/terminals";
import { sessionRegistry } from "@/lib/client/session-registry";
import { cn } from "@/lib/utils";
import { useFileEditor } from "@/hooks/useFileEditor";
import { MobileTabBar } from "./MobileTabBar";
import {
  TerminalSkeleton,
  FileExplorerSkeleton,
  GitPanelSkeleton,
} from "./PaneSkeletons";
import {
  Panel as ResizablePanel,
  Group as ResizablePanelGroup,
  Separator as ResizablePanelHandle,
} from "react-resizable-panels";
import { GitDrawer } from "@/components/GitDrawer";
import { ShellDrawer } from "@/components/ShellDrawer";
import { useSnapshot } from "valtio";
import { fileOpenStore, fileOpenActions } from "@/stores/fileOpen";

// Dynamic imports for client-only components with loading states
const Terminal = dynamic(
  () => import("@/components/Terminal").then((mod) => mod.Terminal),
  { ssr: false, loading: () => <TerminalSkeleton /> }
);

const FileExplorer = dynamic(
  () => import("@/components/FileExplorer").then((mod) => mod.FileExplorer),
  { ssr: false, loading: () => <FileExplorerSkeleton /> }
);

const GitPanel = dynamic(
  () => import("@/components/GitPanel").then((mod) => mod.GitPanel),
  { ssr: false, loading: () => <GitPanelSkeleton /> }
);

interface PaneProps {
  terminals: TerminalRecord[];
  projects: Project[];
  onRegisterTerminal: (ref: TerminalHandle | null) => void;
  onMenuClick?: () => void;
  onSelectTerminal?: (name: string) => void;
}

/**
 * The workbench's single terminal, plus the file and git views that share
 * its working directory.
 *
 * There is one terminal and one tmux attachment. Splitting is delegated to
 * tmux (see /api/tmux/split), so what used to be a tree of React panes with
 * a tab strip on each is now a single surface showing whatever tmux draws.
 */
export const Pane = memo(function Pane({
  terminals,
  projects,
  onRegisterTerminal,
  onMenuClick,
  onSelectTerminal,
}: PaneProps) {
  const { isMobile } = useViewport();
  const {
    paneId,
    attachedTmux,
    viewMode,
    gitDrawerOpen,
    shellDrawerOpen,
    setViewMode,
    toggleGitDrawer,
    toggleShellDrawer,
  } = usePanes();

  const terminalRef = useRef<TerminalHandle | null>(null);

  // The attached tmux session is the source of truth for which working
  // directory the Files and Git views point at.
  const session = useMemo(
    () => terminals.find((t) => t.tmux_name === attachedTmux) ?? null,
    [terminals, attachedTmux]
  );

  const fileEditor = useFileEditor();

  const currentProject = useMemo(() => {
    if (!session?.project_id) return null;
    return projects.find((p) => p.id === session.project_id) || null;
  }, [session?.project_id, projects]);

  const projectRepositories = useMemo(() => {
    if (!currentProject) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (currentProject as any).repositories || [];
  }, [currentProject]);

  const { request: fileOpenRequest } = useSnapshot(fileOpenStore);

  // Reset to the terminal when the attachment changes.
  useEffect(() => {
    setViewMode("terminal");
    fileEditor.reset();
  }, [attachedTmux]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fileOpenRequest && session) {
      setViewMode("files");
      fileEditor.openFile(fileOpenRequest.path);
      fileOpenActions.clearRequest();
    }
  }, [fileOpenRequest, session, fileEditor, setViewMode]);

  const setTerminalRef = useCallback((handle: TerminalHandle | null) => {
    terminalRef.current = handle;
  }, []);

  // Attach on connect. The pty is a plain shell, so attaching is literally
  // running `tmux attach` in it; tmux then owns everything the user sees,
  // including any panes it was split into earlier.
  const handleTerminalConnected = useCallback(() => {
    const handle = terminalRef.current;
    if (!handle) return;

    onRegisterTerminal(handle);

    if (attachedTmux) {
      setTimeout(() => handle.sendCommand(`tmux attach -t ${attachedTmux}`), 100);
    }
  }, [attachedTmux, onRegisterTerminal]);

  useEffect(() => {
    return () => onRegisterTerminal(null);
  }, [onRegisterTerminal]);

  // Swipe between terminals on mobile.
  const touchStartX = useRef<number | null>(null);
  const currentIndex = session
    ? terminals.findIndex((t) => t.id === session.id)
    : -1;
  const SWIPE_THRESHOLD = 120;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (viewMode !== "terminal") return;
      touchStartX.current = e.touches[0].clientX;
    },
    [viewMode]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (viewMode !== "terminal" || touchStartX.current === null) return;

      const diff = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;

      if (Math.abs(diff) <= SWIPE_THRESHOLD) return;

      const nextIndex = diff > 0 ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex >= 0 && nextIndex < terminals.length) {
        onSelectTerminal?.(terminals[nextIndex].id);
      }
    },
    [viewMode, currentIndex, terminals, onSelectTerminal]
  );

  const savedState = sessionRegistry.getTerminalState(paneId, "terminal");

  const terminal = (
    <Terminal
      ref={setTerminalRef}
      onConnected={handleTerminalConnected}
      onBeforeUnmount={(scrollState) => {
        sessionRegistry.saveTerminalState(paneId, "terminal", {
          scrollTop: scrollState.scrollTop,
          scrollHeight: 0,
          lastActivity: Date.now(),
          cursorY: scrollState.cursorY,
        });
      }}
      initialScrollState={
        savedState
          ? {
              scrollTop: savedState.scrollTop,
              cursorY: savedState.cursorY,
              baseY: 0,
            }
          : undefined
      }
    />
  );

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        !isMobile && "bg-background"
      )}
    >
      {/* Mobile keeps a header of its own; on desktop the mode switcher
          lives in the workbench top bar, so the pane has no chrome. */}
      {isMobile && (
        <MobileTabBar
          terminal={session}
          terminals={terminals}
          projects={projects}
          viewMode={viewMode}
          onMenuClick={onMenuClick}
          onViewModeChange={setViewMode}
          onSelectTerminal={onSelectTerminal}
        />
      )}

      {isMobile ? (
        <div
          className="relative min-h-0 w-full flex-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className={viewMode === "terminal" ? "h-full w-full" : "hidden"}>
            {terminal}
          </div>

          {session?.working_directory && (
            <div className={viewMode === "files" ? "h-full" : "hidden"}>
              <FileExplorer
                workingDirectory={session.working_directory}
                fileEditor={fileEditor}
              />
            </div>
          )}

          {session?.working_directory && (
            <div className={viewMode === "git" ? "h-full" : "hidden"}>
              <GitPanel
                workingDirectory={session.working_directory}
                projectId={currentProject?.id}
                repositories={projectRepositories}
              />
            </div>
          )}
        </div>
      ) : (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          {/* Left column: main content + shell drawer */}
          <ResizablePanel defaultSize={gitDrawerOpen ? 70 : 100} minSize={20}>
            <ResizablePanelGroup orientation="vertical" className="h-full">
              <ResizablePanel
                defaultSize={shellDrawerOpen ? 70 : 100}
                minSize={10}
              >
                <div className="relative h-full">
                  <div className={viewMode === "terminal" ? "h-full" : "hidden"}>
                    {terminal}
                  </div>

                  {session?.working_directory && (
                    <div className={viewMode === "files" ? "h-full" : "hidden"}>
                      <FileExplorer
                        workingDirectory={session.working_directory}
                        fileEditor={fileEditor}
                      />
                    </div>
                  )}
                </div>
              </ResizablePanel>

              {shellDrawerOpen && session?.working_directory && (
                <>
                  <ResizablePanelHandle className="bg-border/30 hover:bg-primary/30 active:bg-primary/50 h-px cursor-row-resize transition-colors" />
                  <ResizablePanel defaultSize={30} minSize={10}>
                    <ShellDrawer
                      open={true}
                      onOpenChange={toggleShellDrawer}
                      workingDirectory={session.working_directory}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {gitDrawerOpen && session?.working_directory && (
            <>
              <ResizablePanelHandle className="bg-border/30 hover:bg-primary/30 active:bg-primary/50 w-px cursor-col-resize transition-colors" />
              <ResizablePanel defaultSize={30} minSize={10}>
                <GitDrawer
                  open={true}
                  onOpenChange={toggleGitDrawer}
                  workingDirectory={session.working_directory}
                  projectId={currentProject?.id}
                  repositories={projectRepositories}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}
    </div>
  );
});
