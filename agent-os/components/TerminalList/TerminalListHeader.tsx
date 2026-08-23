import { ADropdownMenu, menuItem } from "@/components/a/ADropdownMenu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  FolderPlus,
  FolderOpen,
  GitBranch,
  MoreHorizontal,
  Trash2,
  Pin,
  PinOff,
} from "lucide-react";

interface TerminalListHeaderProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onCloneFromGithub: () => void;
  onKillAll: () => void;
  pinControls?: {
    isPinned: boolean;
    onTogglePin: () => void;
  };
}

export function TerminalListHeader({
  onNewProject,
  onOpenProject,
  onCloneFromGithub,
  onKillAll,
  pinControls,
}: TerminalListHeaderProps) {
  return (
    <div className="border-sidebar-border border-b px-3 pt-2.5 pb-2">
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
        <div className="flex gap-0.5">
          {pinControls && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={pinControls.onTogglePin}
                >
                  {pinControls.isPinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{pinControls.isPinned ? "Unpin sidebar" : "Pin sidebar"}</p>
              </TooltipContent>
            </Tooltip>
          )}
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
          <ADropdownMenu
            icon={MoreHorizontal}
            tooltip="More options"
            items={[
              menuItem("Kill all sessions", onKillAll, {
                icon: Trash2,
                variant: "destructive",
              }),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
