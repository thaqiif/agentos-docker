"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Terminal as TerminalIcon,
  FolderOpen,
  GitBranch,
  ChevronDown,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/db";
import type { TerminalRecord } from "@/lib/terminals";
import type { LucideIcon } from "lucide-react";

import type { ViewMode } from "@/lib/panes";

/** Segment order, so the sliding selection knows where to sit. */
const VIEW_MODE_ORDER: ViewMode[] = ["terminal", "files", "git"];

interface ViewModeButtonProps {
  mode: ViewMode;
  currentMode: ViewMode;
  icon: LucideIcon;
  onClick: (mode: ViewMode) => void;
  badge?: React.ReactNode;
}

function ViewModeButton({
  mode,
  currentMode,
  icon: Icon,
  onClick,
  badge,
}: ViewModeButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(mode);
      }}
      aria-pressed={currentMode === mode}
      className={cn(
        "press-sm focus-ring relative z-10 flex h-8 min-w-11 items-center justify-center rounded-full",
        "transition-colors duration-200",
        badge && "gap-1 px-2.5",
        currentMode === mode ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {badge && <span className="text-[0.625rem] tabular-nums">{badge}</span>}
    </button>
  );
}

interface MobileTabBarProps {
  terminal: TerminalRecord | null | undefined;
  terminals: TerminalRecord[];
  projects: Project[];
  viewMode: ViewMode;
  onMenuClick?: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSelectTerminal?: (name: string) => void;
}

export function MobileTabBar({
  terminal: session,
  terminals: sessions,
  projects,
  viewMode,
  onMenuClick,
  onViewModeChange,
  onSelectTerminal: onSelectSession,
}: MobileTabBarProps) {
  // Find current session index and calculate prev/next
  const currentIndex = session
    ? sessions.findIndex((s) => s.id === session.id)
    : -1;

  // Get project name for current session
  const projectName = session?.project_id
    ? projects.find((p) => p.id === session.project_id)?.name
    : null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < sessions.length - 1;

  // Debounce to prevent rapid clicking causing command interference
  const [isNavigating, setIsNavigating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleNavigate = useCallback(
    (sessionId: string) => {
      if (isNavigating || !onSelectSession) return;

      setIsNavigating(true);
      onSelectSession(sessionId);

      // Allow next navigation after delay (tmux commands need time)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 500);
    },
    [isNavigating, onSelectSession]
  );

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasPrev && !isNavigating) {
      handleNavigate(sessions[currentIndex - 1].id);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasNext && !isNavigating) {
      handleNavigate(sessions[currentIndex + 1].id);
    }
  };

  return (
    <div
      className="glass glass-edge-bottom relative z-10 flex items-center gap-1.5 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Menu button */}
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick();
          }}
          aria-label="Open sidebar"
          className="h-9 w-9 shrink-0 rounded-full"
        >
          <Menu className="h-[1.125rem] w-[1.125rem]" />
        </Button>
      )}

      {/* Session/Tab navigation */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          onClick={handlePrev}
          onTouchEnd={(e) => e.stopPropagation()}
          disabled={!hasPrev || isNavigating}
          aria-label="Previous terminal"
          className="press focus-ring text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--fill-4)] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Session selector dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="press focus-ring flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 transition-colors hover:bg-[var(--fill-4)]"
            >
              <span className="truncate text-[0.8125rem] font-medium tracking-[-0.006em]">
                {session?.name || "No terminal"}
                {projectName && projectName !== "Uncategorized" && (
                  <span className="text-muted-foreground font-normal">
                    {" · "}
                    {projectName}
                  </span>
                )}
              </span>
              <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="max-h-[300px] min-w-[200px] overflow-y-auto"
          >
            {sessions
              .map((s) => {
                const sessionProject = s.project_id
                  ? projects.find((p) => p.id === s.project_id)
                  : null;
                const isActive = s.id === session?.id;

                return (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => onSelectSession?.(s.id)}
                    className={cn(
                      "flex items-center gap-2",
                      isActive && "bg-[var(--fill-3)]"
                    )}
                  >
                    <Circle
                      className={cn(
                        "h-2 w-2",
                        isActive
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <span className="flex-1 truncate">{s.name}</span>
                    {sessionProject &&
                      sessionProject.name !== "Uncategorized" && (
                        <span className="text-muted-foreground text-[0.6875rem]">
                          {sessionProject.name}
                        </span>
                      )}
                  </DropdownMenuItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={handleNext}
          onTouchEnd={(e) => e.stopPropagation()}
          disabled={!hasNext || isNavigating}
          aria-label="Next terminal"
          className="press focus-ring text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--fill-4)] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* View mode toggle */}
      {session?.working_directory && (
        <div
          role="tablist"
          className="relative flex shrink-0 items-center rounded-full bg-[var(--fill-4)] p-0.5"
        >
          {/* The selection is one pill that travels, not three states that
              blink — same object, new place. */}
          <span
            aria-hidden="true"
            className="absolute top-0.5 bottom-0.5 left-0.5 w-11 rounded-full bg-[var(--fill-1)] shadow-[var(--elev-1)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              transform: `translateX(${VIEW_MODE_ORDER.indexOf(viewMode) * 100}%)`,
            }}
          />
          <ViewModeButton
            mode="terminal"
            currentMode={viewMode}
            icon={TerminalIcon}
            onClick={onViewModeChange}
          />
          <ViewModeButton
            mode="files"
            currentMode={viewMode}
            icon={FolderOpen}
            onClick={onViewModeChange}
          />
          <ViewModeButton
            mode="git"
            currentMode={viewMode}
            icon={GitBranch}
            onClick={onViewModeChange}
          />
        </div>
      )}
    </div>
  );
}
