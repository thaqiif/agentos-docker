"use client";

import {
  SplitSquareHorizontal,
  SplitSquareVertical,
  X,
  Unplug,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/db";

type ViewMode = "terminal" | "files" | "git" | "workers";

interface Tab {
  id: string;
  sessionId: string | null;
  attachedTmux: string | null;
}

interface DesktopTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  session: Session | null | undefined;
  sessions: Session[];
  viewMode: ViewMode;
  isFocused: boolean;
  isConductor: boolean;
  workerCount: number;
  canSplit: boolean;
  canClose: boolean;
  hasAttachedTmux: boolean;
  gitDrawerOpen: boolean;
  shellDrawerOpen: boolean;
  onTabSwitch: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabAdd: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onGitDrawerToggle: () => void;
  onShellDrawerToggle: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
  onDetach: () => void;
}

function ModeCell({
  label,
  active,
  tooltip,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  tooltip: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            "relative flex h-full items-center gap-1 border-l border-border px-2.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors",
            active
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="text-primary font-mono text-[9px]">{badge}</span>
          )}
          {active && (
            <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function PaneControl({
  icon: Icon,
  tooltip,
  disabled,
  onClick,
}: {
  icon: typeof X;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-full w-7 items-center justify-center border-l border-border transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function DesktopTabBar({
  tabs,
  activeTabId,
  session,
  sessions,
  viewMode,
  isFocused,
  isConductor,
  workerCount,
  canSplit,
  canClose,
  hasAttachedTmux,
  gitDrawerOpen,
  shellDrawerOpen,
  onTabSwitch,
  onTabClose,
  onTabAdd,
  onViewModeChange,
  onGitDrawerToggle,
  onShellDrawerToggle,
  onSplitHorizontal,
  onSplitVertical,
  onClose,
  onDetach,
}: DesktopTabBarProps) {
  const getTabName = (tab: Tab) => {
    if (tab.sessionId) {
      const s = sessions.find((sess) => sess.id === tab.sessionId);
      return s?.name || tab.attachedTmux || "Session";
    }
    if (tab.attachedTmux) return tab.attachedTmux;
    return "New Tab";
  };

  return (
    <div
      className={cn(
        "scrollbar-none border-border flex h-9 items-stretch overflow-x-auto border-b transition-colors",
        isFocused ? "bg-surface" : "bg-background"
      )}
    >
      {/* Tabs */}
      <div className="flex min-w-0 flex-1 items-stretch">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={(e) => {
                e.stopPropagation();
                onTabSwitch(tab.id);
              }}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2 border-r border-border px-2.5 text-xs transition-colors",
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[9px] tracking-wider",
                  isActive ? "text-primary" : "text-foreground-subtle"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="max-w-[140px] truncate">{getTabName(tab)}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className="hover:text-foreground text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {isActive && (
                <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
              )}
            </div>
          );
        })}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabAdd();
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center border-r border-border px-2 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New tab</TooltipContent>
        </Tooltip>
      </div>

      {/* Mode strip */}
      {session?.working_directory && (
        <div className="flex items-stretch">
          <ModeCell
            label="Term"
            active={viewMode === "terminal"}
            tooltip="Terminal"
            onClick={() => onViewModeChange("terminal")}
          />
          <ModeCell
            label="Files"
            active={viewMode === "files"}
            tooltip="Files"
            onClick={() => onViewModeChange("files")}
          />
          <ModeCell
            label="Git"
            active={gitDrawerOpen}
            tooltip="Git"
            onClick={onGitDrawerToggle}
          />
          <ModeCell
            label=">_"
            active={shellDrawerOpen}
            tooltip="Shell"
            onClick={onShellDrawerToggle}
          />
          {isConductor && (
            <ModeCell
              label="Workers"
              active={viewMode === "workers"}
              tooltip="Workers"
              badge={workerCount}
              onClick={() => onViewModeChange("workers")}
            />
          )}
        </div>
      )}

      {/* Pane controls */}
      <div className="flex items-stretch">
        {hasAttachedTmux && (
          <PaneControl icon={Unplug} tooltip="Detach from tmux" onClick={onDetach} />
        )}
        <PaneControl
          icon={SplitSquareHorizontal}
          tooltip="Split horizontal"
          disabled={!canSplit}
          onClick={onSplitHorizontal}
        />
        <PaneControl
          icon={SplitSquareVertical}
          tooltip="Split vertical"
          disabled={!canSplit}
          onClick={onSplitVertical}
        />
        <PaneControl
          icon={X}
          tooltip="Close pane"
          disabled={!canClose}
          onClick={onClose}
        />
      </div>
    </div>
  );
}
