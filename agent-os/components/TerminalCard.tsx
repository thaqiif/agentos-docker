"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  GitFork,
  GitBranch,
  GitPullRequest,
  Check,
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
import type { TerminalRecord } from "@/lib/terminals";

type TmuxStatus = "idle" | "running" | "waiting" | "done" | "error" | "dead";

export interface TerminalCardProps {
  terminal: TerminalRecord;
  isActive?: boolean;
  tmuxStatus?: TmuxStatus;
  // Selection props
  isSelected?: boolean;
  isInSelectMode?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
  // Navigation
  onClick?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onHoverStart?: (rect: DOMRect) => void;
  onHoverEnd?: () => void;
}

export function TerminalCard({
  terminal: session,
  isActive,
  tmuxStatus,
  isSelected,
  isInSelectMode,
  onToggleSelect,
  onClick,
  onDelete,
  onRename,
  onHoverStart,
  onHoverEnd,
}: TerminalCardProps) {
  // tmux reports last activity in seconds since the epoch.
  const timeAgo = getTimeAgo(session.activity);
  const status = tmuxStatus || "dead";
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
    onDelete || onRename;

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
        {onRename && (
          <MenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-3 w-3" />
            Rename
          </MenuItem>
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
        "group relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-left transition-colors",
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

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
            <span
              // Double-click to rename, rather than hunting for the menu.
              onDoubleClick={(e) => {
                if (!onRename) return;
                e.stopPropagation();
                setEditName(session.name);
                setIsEditing(true);
              }}
              className="min-w-0 flex-1 truncate text-sm leading-4"
            >
              {session.name}
            </span>
          )}

          {/* Split indicator: a terminal tmux has split into panes. */}
          {session.panes > 1 && (
            <span
              className="text-muted-foreground flex-shrink-0 border border-border px-1 font-mono text-[9px]"
              title={session.panes + " tmux panes"}
            >
              {session.panes}
            </span>
          )}

          {/* Right slot. The timestamp keeps its box and only fades, while
              the menu button is lifted out of flow on desktop and overlays
              it. Toggling the button's display instead made the whole row
              reflow on hover; reserving a box for it left a dead gap. */}
          <span className="hidden flex-shrink-0 font-mono text-[10px] text-muted-foreground transition-opacity sm:block md:group-hover:opacity-0">
            {timeAgo}
          </span>

          {/* Actions menu (button) */}
          {hasActions && (
            <DropdownMenu onOpenChange={handleMenuOpenChange}>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="inline-flex h-6 w-6 flex-shrink-0 transition-opacity md:absolute md:top-1/2 md:right-1 md:h-5 md:w-5 md:-translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
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

      </div>
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

/** @param activity tmux last-activity stamp, in seconds since the epoch. */
function getTimeAgo(activity: number): string {
  if (!activity) return "";
  const now = new Date();
  const diffMs = now.getTime() - activity * 1000;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(activity * 1000).toLocaleDateString();
}
