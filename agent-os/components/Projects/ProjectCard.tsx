"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Settings,
  Plus,
  Server,
  Trash2,
  Pencil,
  FolderOpen,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Project, DevServer } from "@/lib/db";

interface ProjectCardProps {
  project: Project;
  sessionCount: number;
  runningDevServers?: DevServer[];
  onClick?: () => void;
  onToggleExpanded?: (expanded: boolean) => void;
  onEdit?: () => void;
  onNewSession?: () => void;
  onOpenTerminal?: () => void;
  onStartDevServer?: () => void;
  onOpenInEditor?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
}

export function ProjectCard({
  project,
  sessionCount,
  runningDevServers = [],
  onClick,
  onToggleExpanded,
  onEdit,
  onNewSession,
  onOpenTerminal,
  onStartDevServer,
  onOpenInEditor,
  onDelete,
  onRename,
}: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Guards against Enter and the follow-up blur both committing. */
  const committedRef = useRef(false);

  const hasRunningServers = runningDevServers.length > 0;
  // Uncategorized can have New Session, Open Terminal, and Rename, but not Edit/Delete/DevServer
  const hasActions = project.is_uncategorized
    ? onNewSession || onOpenTerminal || onRename
    : onEdit ||
      onNewSession ||
      onOpenTerminal ||
      onStartDevServer ||
      onDelete ||
      onRename;

  useEffect(() => {
    if (!isEditing) return;
    committedRef.current = false;
    // Always start from the project's current name, so a cancelled edit
    // does not leak into the next one.
    setEditName(project.name);

    // rAF rather than a timeout race: by the next frame Radix has finished
    // unmounting the menu, so nothing steals focus back off the input.
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditing, project.name]);

  const commitRename = () => {
    if (committedRef.current) return;
    committedRef.current = true;

    const next = editName.trim();
    if (next && next !== project.name) onRename?.(next);
    setIsEditing(false);
  };

  const cancelRename = () => {
    committedRef.current = true;
    setEditName(project.name);
    setIsEditing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    onClick?.();
    onToggleExpanded?.(!project.expanded);
  };

  const renderMenuItems = (isContextMenu: boolean) => {
    const MenuItem = isContextMenu ? ContextMenuItem : DropdownMenuItem;
    const MenuSeparator = isContextMenu
      ? ContextMenuSeparator
      : DropdownMenuSeparator;

    return (
      <>
        {onNewSession && (
          <MenuItem onClick={() => onNewSession()}>
            <Plus className="mr-2 h-3 w-3" />
            New session
          </MenuItem>
        )}
        {onOpenTerminal && (
          <MenuItem onClick={() => onOpenTerminal()}>
            <Terminal className="mr-2 h-3 w-3" />
            Open terminal
          </MenuItem>
        )}
        {onEdit && (
          <MenuItem onClick={() => onEdit()}>
            <Settings className="mr-2 h-3 w-3" />
            Project settings
          </MenuItem>
        )}
        {onRename && (
          <MenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-3 w-3" />
            Rename
          </MenuItem>
        )}
        {onOpenInEditor && (
          <MenuItem onClick={() => onOpenInEditor()}>
            <FolderOpen className="mr-2 h-3 w-3" />
            Open in editor
          </MenuItem>
        )}
        {onStartDevServer && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => onStartDevServer()}>
              <Server className="mr-2 h-3 w-3" />
              Start dev server
            </MenuItem>
          </>
        )}
        {onDelete && (
          <>
            <MenuSeparator />
            <MenuItem
              onClick={() => onDelete()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Delete project
            </MenuItem>
          </>
        )}
      </>
    );
  };

  const cardContent = (
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-none px-2 py-2",
        "min-h-[40px] md:min-h-[34px]",
        "hover:bg-accent/50"
      )}
    >
      {/* Expand/collapse toggle */}
      <button
        aria-hidden
        tabIndex={-1}
        className="flex-shrink-0 text-muted-foreground transition-transform duration-150"
      >
        {project.expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Project name + path */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelRename();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 border-b border-primary bg-transparent text-sm font-medium outline-none"
        />
      ) : (
        <div className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">
            {project.name}
          </span>
          <span className="tech-meta block truncate">
            {project.working_directory}
          </span>
        </div>
      )}

      {/* Running servers indicator */}
      {hasRunningServers && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-status-running">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              server
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {runningDevServers.length} dev server
              {runningDevServers.length > 1 ? "s" : ""} running
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Session count keeps its box and fades; the menu overlays it on
          desktop rather than joining the flow, so hovering does not shift
          the row. */}
      <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground transition-opacity md:group-hover:opacity-0">
        {String(sessionCount).padStart(2, "0")}
      </span>

      {/* Actions menu */}
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="inline-flex h-7 w-7 flex-shrink-0 transition-opacity md:absolute md:top-1/2 md:right-1 md:h-6 md:w-6 md:-translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // Without this Radix returns focus to the trigger on close, which
            // instantly blurs the rename input and cancelled every rename.
            onCloseAutoFocus={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            {renderMenuItems(false)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // Wrap with context menu if actions are available
  if (hasActions) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{cardContent}</ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {renderMenuItems(true)}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return cardContent;
}
