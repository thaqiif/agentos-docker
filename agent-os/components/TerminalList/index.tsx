"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ServerLogsModal } from "@/components/DevServers";
import {
  ProjectsSection,
  NewProjectDialog,
  ProjectSettingsDialog,
} from "@/components/Projects";
import { FolderPicker } from "@/components/FolderPicker";
import { TerminalListHeader } from "./TerminalListHeader";
import { KillAllConfirm } from "./KillAllConfirm";
import { useTerminalListMutations } from "./hooks/useTerminalListMutations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectSectionSkeleton } from "@/components/ui/skeleton";
import { FolderPlus, TriangleAlert } from "lucide-react";
import { AEmptyState } from "@/components/a/AEmptyState";
import type { TerminalRecord } from "@/lib/terminals";
import type { ProjectWithRepositories } from "@/lib/projects";
import { useViewport } from "@/hooks/useViewport";

// Data hooks
import { useTerminalsQuery } from "@/data/terminals";
import { useProjectsQuery, useCreateProject } from "@/data/projects";
import { useDevServersQuery } from "@/data/dev-servers";

import type { TerminalListProps } from "./TerminalList.types";

export type { TerminalListProps } from "./TerminalList.types";

export function TerminalList({
  activeSessionId,
  terminalStatuses,
  onSelect,
  onNewTerminal,
  onCloseTerminal,
  onStartDevServer,
  onCreateDevServer,
  notifications,
  onQuickSwitch,
}: TerminalListProps) {
  const { isMobile } = useViewport();

  // Fetch data directly with loading states
  const {
    data: terminalsData,
    isPending: isTerminalsPending,
    isError: isTerminalsError,
    error: terminalsError,
  } = useTerminalsQuery();
  const {
    data: projects = [],
    isPending: isProjectsPending,
    isError: isProjectsError,
  } = useProjectsQuery();
  const { data: devServers = [] } = useDevServersQuery();

  // Combined loading state for initial load
  const isInitialLoading = isTerminalsPending || isProjectsPending;
  const hasError = isTerminalsError || isProjectsError;

  const sessions: TerminalRecord[] = terminalsData ?? [];

  // All mutations via custom hook
  const mutations = useTerminalListMutations();

  // Project creation mutation for folder picker
  const createProject = useCreateProject();

  // Local UI state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectMode, setNewProjectMode] = useState<"new" | "clone">("new");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [editingProject, setEditingProject] =
    useState<ProjectWithRepositories | null>(null);
  const [showKillAllConfirm, setShowKillAllConfirm] = useState(false);
  const [hoveredSession, setHoveredSession] =
    useState<TerminalRecord | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [logsServerId, setLogsServerId] = useState<string | null>(null);

  // Use projects if available
  const useProjectsView = projects.length > 0;

  // Flatten all session IDs for bulk operations
  const allSessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);

  // Find server for logs modal
  const logsServer = logsServerId
    ? devServers.find((s) => s.id === logsServerId)
    : null;

  // Handle hover on session card (desktop only) with delay
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingHoverRef = useRef<{
    session: TerminalRecord;
    rect: DOMRect;
  } | null>(null);

  const hoverHandlers = {
    onHoverStart: useCallback(
      (session: TerminalRecord, rect: DOMRect) => {
        if (isMobile) return;
        // Clear any pending hover
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        // Store pending hover data and start delay
        pendingHoverRef.current = { session, rect };
        hoverTimeoutRef.current = setTimeout(() => {
          if (pendingHoverRef.current) {
            setHoveredSession(pendingHoverRef.current.session);
            setHoverPosition({
              x: pendingHoverRef.current.rect.right,
              y: pendingHoverRef.current.rect.top,
            });
          }
        }, 400);
      },
      [isMobile]
    ),
    onHoverEnd: useCallback(() => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      pendingHoverRef.current = null;
      setHoveredSession(null);
    }, []),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <TerminalListHeader
        onNewProject={() => {
          setNewProjectMode("new");
          setShowNewProjectDialog(true);
        }}
        onOpenProject={() => setShowFolderPicker(true)}
        onCloneFromGithub={() => {
          setNewProjectMode("clone");
          setShowNewProjectDialog(true);
        }}
        onKillAll={() => setShowKillAllConfirm(true)}
        notifications={notifications}
        onQuickSwitch={onQuickSwitch}
      />

      {/* Kill All Confirmation */}
      {showKillAllConfirm && (
        <KillAllConfirm
          onCancel={() => setShowKillAllConfirm(false)}
          onComplete={() => setShowKillAllConfirm(false)}
        />
      )}


      {/* Session list */}
      <ScrollArea className="w-full flex-1">
        <div className="scrollbar-thin max-w-full px-2 py-2">
          {/* Loading state */}
          {isInitialLoading && <ProjectSectionSkeleton count={2} />}

          {/* Error state */}
          {hasError && !isInitialLoading && (
            <AEmptyState
              size="compact"
              tone="error"
              icon={TriangleAlert}
              title="Couldn't load terminals"
              description={terminalsError?.message || "Unknown error"}
              action={{ label: "Try again", onClick: mutations.handleRefresh }}
            />
          )}

          {/* Empty state */}
          {!isInitialLoading &&
            !hasError &&
            sessions.length === 0 &&
            projects.length <= 1 && (
              <AEmptyState
                size="compact"
                icon={FolderPlus}
                title="No terminals yet"
                description="Create a project to group the sessions you run in it."
                action={{
                  label: "New project",
                  icon: FolderPlus,
                  onClick: () => setShowNewProjectDialog(true),
                }}
              />
            )}

          {/* Content - Projects view */}
          {!isInitialLoading && !hasError && useProjectsView && (
            <ProjectsSection
              projects={projects}
              terminals={sessions}
              activeSessionId={activeSessionId}
              terminalStatuses={terminalStatuses}
              devServers={devServers}
              onToggleProject={mutations.handleToggleProject}
              onEditProject={(projectId) => {
                const project = projects.find((p) => p.id === projectId);
                if (project) setEditingProject(project);
              }}
              onDeleteProject={mutations.handleDeleteProject}
              onRenameProject={mutations.handleRenameProject}
              onNewTerminal={onNewTerminal}
              onSelectTerminal={onSelect}
              onCloseTerminal={onCloseTerminal ?? mutations.handleDeleteTerminal}
              onRenameTerminal={mutations.handleRenameTerminal}
              onStartDevServer={onStartDevServer}
              onStopDevServer={mutations.handleStopDevServer}
              onRestartDevServer={mutations.handleRestartDevServer}
              onRemoveDevServer={mutations.handleRemoveDevServer}
              onViewDevServerLogs={setLogsServerId}
              onHoverStart={(session, rect) =>
                hoverHandlers.onHoverStart(session, rect)
              }
              onHoverEnd={hoverHandlers.onHoverEnd}
            />
          )}
        </div>
      </ScrollArea>


      {/* {!isMobile && (
        <SessionPreviewPopover
          session={hoveredSession}
          status={
            hoveredSession
              ? sessionStatuses?.[hoveredSession.id]?.status
              : undefined
          }
          position={hoverPosition}
        />
      )} */}

      {/* Server Logs Modal */}
      {logsServer && (
        <ServerLogsModal
          serverId={logsServer.id}
          serverName={logsServer.name}
          onClose={() => setLogsServerId(null)}
        />
      )}

      {/* New Project Dialog */}
      <NewProjectDialog
        open={showNewProjectDialog}
        mode={newProjectMode}
        onClose={() => setShowNewProjectDialog(false)}
        onCreated={() => setShowNewProjectDialog(false)}
      />

      {/* Folder Picker for Open Project */}
      {showFolderPicker && (
        <FolderPicker
          initialPath="~"
          onClose={() => setShowFolderPicker(false)}
          onSelect={(path) => {
            // Derive project name from folder path
            const parts = path.split("/").filter(Boolean);
            const name = parts[parts.length - 1] || "project";

            createProject.mutate(
              {
                name,
                workingDirectory: path,
                agentType: "claude",
                defaultModel: "sonnet",
                devServers: [],
              },
              {
                onSuccess: () => setShowFolderPicker(false),
                onError: (err) => {
                  console.error("Failed to create project:", err);
                  setShowFolderPicker(false);
                },
              }
            );
          }}
        />
      )}

      {/* Project Settings Dialog */}
      <ProjectSettingsDialog
        project={editingProject}
        open={editingProject !== null}
        onClose={() => setEditingProject(null)}
        onSave={() => setEditingProject(null)}
      />
    </div>
  );
}
