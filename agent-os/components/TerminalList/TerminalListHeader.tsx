"use client";

import { useState, type ReactNode } from "react";
import {
  ADropdownMenu,
  menuItem,
  separator,
} from "@/components/a/ADropdownMenu";
import { ThemeDialog } from "@/components/ThemeDialog";
import {
  Plus,
  FolderPlus,
  FolderOpen,
  GitBranch,
  MoreHorizontal,
  Trash2,
  Palette,
  Command,
} from "lucide-react";

interface TerminalListHeaderProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onCloneFromGithub: () => void;
  onKillAll: () => void;
  onQuickSwitch?: () => void;
  /**
   * The notification bell, rendered by whoever owns its state. It sits
   * between the new-project and the overflow menus, so it is next to the
   * terminals it is telling you about.
   */
  notifications?: ReactNode;
}

export function TerminalListHeader({
  onNewProject,
  onOpenProject,
  onCloneFromGithub,
  onKillAll,
  onQuickSwitch,
  notifications,
}: TerminalListHeaderProps) {
  const [showThemeDialog, setShowThemeDialog] = useState(false);

  return (
    <div className="border-sidebar-border border-b px-3.5 pt-3 pb-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="text-primary h-4 w-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="1" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
          <h2 className="text-sm font-semibold tracking-tight">AgentOS</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <ADropdownMenu
            icon={Plus}
            tooltip="New project"
            items={[
              menuItem("New Project", onNewProject, { icon: FolderPlus }),
              menuItem("Open Project", onOpenProject, { icon: FolderOpen }),
              menuItem("Clone from GitHub", onCloneFromGithub, {
                icon: GitBranch,
              }),
            ]}
          />
          {notifications}
          <ADropdownMenu
            icon={MoreHorizontal}
            tooltip="More options"
            items={[
              ...(onQuickSwitch
                ? [
                    menuItem("Quick Switch  ⌘K", onQuickSwitch, {
                      icon: Command,
                    }),
                  ]
                : []),
              menuItem("Theme…", () => setShowThemeDialog(true), {
                icon: Palette,
              }),
              separator(),
              menuItem("Close all terminals", onKillAll, {
                icon: Trash2,
                variant: "destructive",
              }),
            ]}
          />
        </div>
      </div>

      <ThemeDialog open={showThemeDialog} onOpenChange={setShowThemeDialog} />
    </div>
  );
}
