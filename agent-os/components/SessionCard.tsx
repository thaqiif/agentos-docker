"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  GitFork,
  GitBranch,
  GitPullRequest,
  Circle,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  FolderInput,
  Trash2,
  Copy,
  Pencil,
  Sparkles,
  Square,
  CheckSquare,
  ExternalLink,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { Session, Group } from "@/lib/db";
import type { ProjectWithDevServers } from "@/lib/projects";

type TmuxStatus = "idle" | "running" | "waiting" | "error" | "dead";

interface SessionCardProps {
  session: Session;
  isActive?: boolean;
  isSummarizing?: boolean;
  tmuxStatus?: TmuxStatus;
  groups?: Group[];
  projects?: ProjectWithDevServers[];
  // Selection props
  isSelected?: boolean;
  isInSelectMode?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
  // Navigation
  onClick?: () => void;
  onOpenInTab?: () => void;
  onMove?: (groupPath: string) => void;
  onMoveToProject?: (projectId: string) => void;
  onFork?: () => void;
  onSummarize?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onCreatePR?: () => void;
  onHoverStart?: (rect: DOMRect) => void;
  onHoverEnd?: () => void;
}

const statusConfig: Record<
  TmuxStatus,
  { color: string; label: string; icon: React.ReactNode }
> = {
  idle: {
    color: "text-muted-foreground",
    label: "idle",
    icon: <Circle className="h-1.5 w-1.5 rounded-full bg-current" />,
  },
  running: {
    color: "text-status-running",
    label: "running",
    icon: <Circle className="h-2 w-2 rounded-full bg-current" />,
  },
  waiting: {
    color: "text-status-waiting animate-status-pulse",
    label: "waiting",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  error: {
    color: "text-status-error",
    label: "error",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  dead: {
    color: "text-foreground-subtle",
    label: "stopped",
    icon: <Circle className="h-1.5 w-1.5 rounded-full border border-current" />,
  },
};

export function SessionCard({
  session,
  isActive,
  isSummarizing,
  tmuxStatus,
  groups = [],
  projects = [],
  isSelected,
  isInSelectMode,
  onToggleSelect,
  onClick,
  onOpenInTab,
  onMove,
  onMoveToProject,
  onFork,
  onSummarize,
  onDelete,
  onRename,
  onCreatePR,
  onHoverStart,
  onHoverEnd,
}: SessionCardProps) {
  const timeAgo = getTimeAgo(session.updated_at);
  const status = tmuxStatus || "dead";
  const config = statusConfig[status];
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const justStartedEditingRef = useRef(false);

  const handleMouseEnter = () => {
    if (!onHoverStart || !cardRef.current || menuOpen) return;
    // Debounce hover to avoid flickering
    hoverTimeoutRef.current = setTimeout(() => {
      if (cardRef.current && !menuOpen) {
        onHoverStart(cardRef.current.getBoundingClientRect());
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    onHoverEnd?.();
  };

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (open) {
      // Cancel hover preview when menu opens
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      onHoverEnd?.();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;
      // Mark that we just started editing to ignore immediate blur
      justStartedEditingRef.current = true;
      // Small timeout to ensure input is fully mounted
      setTimeout(() => {
        input.focus();
        input.select();
        // Clear the flag after focus is established
        setTimeout(() => {
          justStartedEditingRef.current = false;
        }, 100);
      }, 0);
    }
  }, [isEditing]);

  const handleRename = () => {
    // Ignore blur events that happen immediately after starting to edit
    if (justStartedEditingRef.current) return;

    if (editName.trim() && editName !== session.name && onRename) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const hasActions =
    onMove ||
    onMoveToProject ||
    onFork ||
    onDelete ||
    onRename ||
    onCreatePR ||
    onOpenInTab;

  // Handle card click - coordinates selection with navigation
  const handleCardClick = (e: React.MouseEvent) => {
    if (isEditing) return;

    // If in select mode (any items selected), any click toggles selection
    if (isInSelectMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(e.shiftKey);
      return;
    }

    // Not in select mode - shift+click starts selection
    if (e.shiftKey && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(false);
      return;
    }

    // Normal click - navigate to session
    onClick?.();
  };

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(e.shiftKey);
  };

  // Shared menu items renderer for both context menu and dropdown
  const renderMenuItems = (isContextMenu: boolean) => {
    const MenuItem = isContextMenu ? ContextMenuItem : DropdownMenuItem;
    const MenuSeparator = isContextMenu
      ? ContextMenuSeparator
      : DropdownMenuSeparator;
    const MenuSub = isContextMenu ? ContextMenuSub : DropdownMenuSub;
    const MenuSubTrigger = isContextMenu
      ? ContextMenuSubTrigger
      : DropdownMenuSubTrigger;
    const MenuSubContent = isContextMenu
      ? ContextMenuSubContent
      : DropdownMenuSubContent;

    return (
      <>
        {/* Branch info for worktree sessions */}
        {session.branch_name && (
          <>
            <div className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-xs">
              <GitBranch className="h-3 w-3" />
              <span className="truncate">{session.branch_name}</span>
            </div>
            <MenuSeparator />
          </>
        )}
        {onOpenInTab && (
          <MenuItem onClick={() => onOpenInTab()}>
            <ExternalLink className="mr-2 h-3 w-3" />
            Open in new tab
          </MenuItem>
        )}
        {onRename && (
          <MenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-3 w-3" />
            Rename
          </MenuItem>
        )}
        {onFork && (session.agent_type === "claude" || session.agent_type?.startsWith("claude-")) && (
          <MenuItem onClick={() => onFork()}>
            <Copy className="mr-2 h-3 w-3" />
            Fork session
          </MenuItem>
        )}
        {onSummarize && (
          <MenuItem onClick={() => onSummarize()} disabled={isSummarizing}>
            {isSummarizing ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3 w-3" />
            )}
            {isSummarizing ? "Summarizing..." : "Fresh start"}
          </MenuItem>
        )}
        {onCreatePR && session.branch_name && (
          <MenuItem
            onClick={() => {
              if (session.pr_url) {
                window.open(session.pr_url, "_blank");
              } else {
                onCreatePR();
              }
            }}
          >
            <GitPullRequest className="mr-2 h-3 w-3" />
            {session.pr_url ? "Open PR" : "Create PR"}
          </MenuItem>
        )}
        {onMoveToProject && projects.length > 0 && (
          <MenuSub>
            <MenuSubTrigger>
              <FolderInput className="mr-2 h-3 w-3" />
              Move to project...
            </MenuSubTrigger>
            <MenuSubContent>
              {projects
                .filter((p) => p.id !== session.project_id)
                .map((project) => (
                  <MenuItem
                    key={project.id}
                    onClick={() => onMoveToProject(project.id)}
                  >
                    {project.name}
                  </MenuItem>
                ))}
            </MenuSubContent>
          </MenuSub>
        )}
        {onMove && groups.length > 0 && (
          <MenuSub>
            <MenuSubTrigger>
              <FolderInput className="mr-2 h-3 w-3" />
              Move to group...
            </MenuSubTrigger>
            <MenuSubContent>
              {groups
                .filter((g) => g.path !== session.group_path)
                .map((group) => (
                  <MenuItem key={group.path} onClick={() => onMove(group.path)}>
                    {group.name}
                  </MenuItem>
                ))}
            </MenuSubContent>
          </MenuSub>
        )}
        {onDelete && (
          <>
            <MenuSeparator />
            <MenuItem
              onClick={() => onDelete()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Delete session
            </MenuItem>
          </>
        )}
      </>
    );
  };

  const cardContent = (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-none px-2 py-1.5 text-left transition-colors",
        "min-h-[36px] md:min-h-0",
        isSelected
          ? "bg-primary/15"
          : isActive
            ? "bg-accent"
            : "hover:bg-accent/50",
        status === "waiting" &&
          !isActive &&
          !isSelected &&
          "bg-status-waiting/5"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
      )}
      {/* Selection checkbox - visible when in select mode */}
      {isInSelectMode && onToggleSelect && (
        <button
          onClick={handleCheckboxClick}
          className="text-primary hover:text-primary/80 flex-shrink-0"
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Status indicator - hidden when in select mode */}
      {!isInSelectMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex-shrink-0", config.color)}>
              {config.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span className="capitalize">{config.label}</span>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Session name */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") {
              setEditName(session.name);
              setIsEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 border-b border-primary bg-transparent font-mono text-xs outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{session.name}</span>
      )}

      {/* Fork indicator */}
      {session.parent_session_id && (
        <GitFork className="text-muted-foreground h-3 w-3 flex-shrink-0" />
      )}

      {/* PR status badge */}
      {session.pr_status && (
        <a
          href={session.pr_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex flex-shrink-0 items-center gap-0.5 border border-border px-1 font-mono text-[9px] uppercase",
            session.pr_status === "open" && "text-status-running",
            session.pr_status === "merged" && "text-primary",
            session.pr_status === "closed" && "text-status-error"
          )}
          title={`PR #${session.pr_number}: ${session.pr_status}`}
        >
          <GitPullRequest className="h-2.5 w-2.5" />
          <span>
            {session.pr_status === "merged"
              ? "M"
              : session.pr_status === "closed"
                ? "X"
                : "O"}
          </span>
        </a>
      )}

      {/* Time ago */}
      <span className="hidden flex-shrink-0 font-mono text-[10px] text-muted-foreground group-hover:hidden sm:block">
        {timeAgo}
      </span>

      {/* Actions menu (button) */}
      {hasActions && (
        <DropdownMenu onOpenChange={handleMenuOpenChange}>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 flex-shrink-0 opacity-100 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
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
        <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>{renderMenuItems(true)}</ContextMenuContent>
      </ContextMenu>
    );
  }

  return cardContent;
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z"); // Assume UTC
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
