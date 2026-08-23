"use client";

import { useMemo, useCallback } from "react";
import { useSnapshot } from "valtio";
import { ProjectCard } from "./ProjectCard";
import { TerminalCard } from "@/components/TerminalCard";
import { DevServerCard } from "@/components/DevServers/DevServerCard";
import { selectionStore, selectionActions } from "@/stores/sessionSelection";
import type { DevServer } from "@/lib/db";
import type { TerminalRecord } from "@/lib/terminals";
import type { ProjectWithDevServers } from "@/lib/projects";

interface SessionStatus {
  sessionName: string;
  status: "idle" | "running" | "waiting" | "done" | "error" | "dead";
  lastLine?: string;
}

export interface ProjectsSectionProps {
  projects: ProjectWithDevServers[];
  terminals: TerminalRecord[];
  /** tmux session name of the terminal currently attached. */
  activeSessionId?: string;
  /** Keyed by tmux session name. */
  terminalStatuses?: Record<string, SessionStatus>;
  devServers?: DevServer[];
  onToggleProject?: (projectId: string, expanded: boolean) => void;
  onEditProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onNewTerminal?: (projectId?: string) => void;
  onSelectTerminal: (name: string) => void;
  onCloseTerminal?: (name: string) => void;
  onRenameTerminal?: (name: string, newName: string) => void;
  onStartDevServer?: (projectId: string) => void;
  onStopDevServer?: (serverId: string) => Promise<void>;
  onRestartDevServer?: (serverId: string) => Promise<void>;
  onRemoveDevServer?: (serverId: string) => Promise<void>;
  onViewDevServerLogs?: (serverId: string) => void;
  onHoverStart?: (terminal: TerminalRecord, rect: DOMRect) => void;
  onHoverEnd?: () => void;
}

export function ProjectsSection({
  projects,
  terminals: sessions,
  activeSessionId,
  terminalStatuses: sessionStatuses,
  devServers = [],
  onToggleProject,
  onEditProject,
  onDeleteProject,
  onRenameProject,
  onNewTerminal,
  onSelectTerminal: onSelectSession,
  onCloseTerminal: onDeleteSession,
  onRenameTerminal: onRenameSession,
  onStartDevServer,
  onStopDevServer,
  onRestartDevServer,
  onRemoveDevServer,
  onViewDevServerLogs,
  onHoverStart,
  onHoverEnd,
}: ProjectsSectionProps) {
  const { selectedIds } = useSnapshot(selectionStore);
  const isInSelectMode = selectedIds.size > 0;

  // Flatten all session IDs for range selection (respecting render order)
  const allSessionIds = useMemo(() => {
    const ids: string[] = [];
    for (const project of projects) {
      const projectSessions = sessions.filter(
        (s) => (s.project_id || "uncategorized") === project.id
      );
      for (const session of projectSessions) ids.push(session.id);
    }
    return ids;
  }, [projects, sessions]);

  // Handler for toggling session selection
  const handleToggleSelect = useCallback(
    (sessionId: string, shiftKey: boolean) => {
      selectionActions.toggle(sessionId, shiftKey, allSessionIds);
    },
    [allSessionIds]
  );

  // Group terminals by the project their working directory falls under.
  const sessionsByProject = sessions.reduce(
    (acc, session) => {
      const projectId = session.project_id || "uncategorized";
      if (!acc[projectId]) acc[projectId] = [];
      acc[projectId].push(session);
      return acc;
    },
    {} as Record<string, TerminalRecord[]>
  );

  // Get running dev servers for a project (for ProjectCard badge)
  const getProjectRunningServers = (projectId: string): DevServer[] => {
    return devServers.filter(
      (ds) => ds.project_id === projectId && ds.status === "running"
    );
  };

  // Get all dev servers for a project
  const getProjectDevServers = (projectId: string): DevServer[] => {
    return devServers.filter((ds) => ds.project_id === projectId);
  };

  return (
    <div className="divide-border divide-y">
      {projects.map((project) => {
        const projectSessions = sessionsByProject[project.id] || [];
        const runningServers = getProjectRunningServers(project.id);
        const projectDevServers = getProjectDevServers(project.id);

        return (
          <div key={project.id} className="space-y-1 py-1.5 first:pt-0.5">
            {/* Project header */}
            <ProjectCard
              project={project}
              sessionCount={projectSessions.length}
              runningDevServers={runningServers}
              onToggleExpanded={(expanded) =>
                onToggleProject?.(project.id, expanded)
              }
              onEdit={
                !project.is_uncategorized && onEditProject
                  ? () => onEditProject(project.id)
                  : undefined
              }
              onNewTerminal={
                onNewTerminal ? () => onNewTerminal(project.id) : undefined
              }
              onStartDevServer={
                !project.is_uncategorized && onStartDevServer
                  ? () => onStartDevServer(project.id)
                  : undefined
              }
              onDelete={
                !project.is_uncategorized && onDeleteProject
                  ? () => onDeleteProject(project.id)
                  : undefined
              }
              onRename={
                onRenameProject
                  ? (newName) => onRenameProject(project.id, newName)
                  : undefined
              }
            />

            {/* Project contents when expanded */}
            {project.expanded && (
              <div className="ml-4 space-y-0.5 pb-1 pl-1">
                {/* Dev servers for this project */}
                {projectDevServers.length > 0 && (
                  <div className="space-y-px pb-0.5">
                    {projectDevServers.map((server) => (
                      <DevServerCard
                        key={server.id}
                        server={server}
                        onStart={
                          onRestartDevServer
                            ? (id) => onRestartDevServer(id)
                            : async () => {}
                        }
                        onStop={onStopDevServer || (async () => {})}
                        onRestart={onRestartDevServer || (async () => {})}
                        onRemove={onRemoveDevServer || (async () => {})}
                        onViewLogs={
                          onViewDevServerLogs
                            ? (id) => onViewDevServerLogs(id)
                            : () => {}
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Project sessions */}
                {projectSessions.length === 0 &&
                projectDevServers.length === 0 ? (
                  <p className="tech-label px-2 py-2">terminals 000</p>
                ) : projectSessions.length === 0 ? null : (
                  projectSessions.map((session) => (
                    <div key={session.id} className="min-w-0">
                      <TerminalCard
                        terminal={session}
                        isActive={session.id === activeSessionId}
                        tmuxStatus={sessionStatuses?.[session.id]?.status}
                        statusDetail={sessionStatuses?.[session.id]?.lastLine}
                        isSelected={selectedIds.has(session.id)}
                        isInSelectMode={isInSelectMode}
                        onToggleSelect={(shiftKey) =>
                          handleToggleSelect(session.id, shiftKey)
                        }
                        onClick={() => onSelectSession(session.id)}
                        onDelete={
                          onDeleteSession
                            ? () => onDeleteSession(session.id)
                            : undefined
                        }
                        onRename={
                          onRenameSession
                            ? (newName) => onRenameSession(session.id, newName)
                            : undefined
                        }
                        onHoverStart={
                          onHoverStart
                            ? (rect) => onHoverStart(session, rect)
                            : undefined
                        }
                        onHoverEnd={onHoverEnd}
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
