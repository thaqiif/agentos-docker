import {
  ADropdownMenu,
  menuItem,
  toggleItem,
  submenuItem,
  separator,
} from "@/components/a/ADropdownMenu";
import { useTheme } from "next-themes";
import {
  DARK_THEMES,
  LIGHT_THEMES,
  parseTheme,
  buildTheme,
  type DarkThemeVariant,
  type LightThemeVariant,
} from "@/lib/theme-config";
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
  PanelLeft,
  Palette,
  Info,
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
  const { theme, setTheme } = useTheme();
  const { mode, variant } = parseTheme(theme || "system");

  // Theme and the project credit used to sit in a footer pinned to the
  // bottom of the sidebar, taking vertical space from the terminal list for
  // two things nobody clicks often. They live in this menu now.
  const themeItems = [
    toggleItem("System", mode === "system", () => setTheme("system")),
    separator(),
    ...DARK_THEMES.map((t) =>
      toggleItem(
        t.label,
        mode === "dark" && (variant ?? "deep") === t.id,
        () => setTheme(buildTheme("dark", t.id as DarkThemeVariant))
      )
    ),
    separator(),
    ...LIGHT_THEMES.map((t) =>
      toggleItem(
        t.label,
        mode === "light" && (variant ?? "default") === t.id,
        () => setTheme(buildTheme("light", t.id as LightThemeVariant))
      )
    ),
  ];

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
                  <PanelLeft className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle sidebar</p>
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
              submenuItem("Theme", themeItems, { icon: Palette }),
              menuItem(
                "About aTerm",
                () => window.open("https://aterm.app", "_blank", "noopener"),
                { icon: Info }
              ),
              separator(),
              menuItem("Close all terminals", onKillAll, {
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
