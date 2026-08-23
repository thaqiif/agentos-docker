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
  runningDevServers?: DevServer[];
  onClick?: () => void;
  onToggleExpanded?: (expanded: boolean) => void;
  onEdit?: () => void;
  onNewTerminal?: () => void;
  onStartDevServer?: () => void;
  onOpenInEditor?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
}

export function ProjectCard({
  project,
  runningDevServers = [],
  onClick,
  onToggleExpanded,
  onEdit,
  onNewTerminal,
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
  // Uncategorized can be renamed but not edited, deleted, or given a dev
  // server. New terminal is its own button, not a menu entry.
  const hasActions = project.is_uncategorized
    ? onRename
    : onEdit || onStartDevServer || onDelete || onRename;

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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
              {project.name}
            </span>
          </TooltipTrigger>
          {/* The path is still worth having, just not on screen at all
              times: it is the same prefix on most rows. */}
          <TooltipContent side="right">
            <p className="font-mono text-xs">{project.working_directory}</p>
          </TooltipContent>
        </Tooltip>
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

      {/* Row actions. Both buttons sit in the flow, side by side: the menu
          used to be absolutely positioned against the row's right edge,
          which parked it on top of the new-terminal button. */}
      <div className="flex flex-shrink-0 items-center gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        {onNewTerminal && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 md:h-6 md:w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewTerminal();
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>New terminal</p>
            </TooltipContent>
          </Tooltip>
        )}

        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 md:h-6 md:w-6"
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
