"use client";

import { SplitSquareHorizontal, SplitSquareVertical } from "lucide-react";
import { usePanes } from "@/contexts/PaneContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The workbench's view controls, hoisted out of the terminal.
 *
 * These used to be a strip on every pane's tab bar. There is one terminal
 * now, so they belong to the workbench, not to a pane — and the splits go
 * to tmux, which means they outlive the page.
 */

function BarCell({
  label,
  active,
  tooltip,
  onClick,
}: {
  label: string;
  active: boolean;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex h-7 items-center px-2.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function BarControl({
  icon: Icon,
  tooltip,
  disabled,
  onClick,
}: {
  icon: typeof SplitSquareHorizontal;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function WorkbenchBar() {
  const {
    attachedTmux,
    viewMode,
    gitDrawerOpen,
    shellDrawerOpen,
    setViewMode,
    toggleGitDrawer,
    toggleShellDrawer,
    splitPane,
  } = usePanes();

  // Nothing attached means the welcome screen is up: there is no terminal
  // to split and no working directory for files or git to point at.
  if (!attachedTmux) return null;

  return (
    <div className="flex items-center gap-1">
      <div className="border-border flex items-stretch border">
        <BarCell
          label="Term"
          active={viewMode === "terminal"}
          tooltip="Terminal"
          onClick={() => setViewMode("terminal")}
        />
        <BarCell
          label="Files"
          active={viewMode === "files"}
          tooltip="Files"
          onClick={() => setViewMode("files")}
        />
        <BarCell
          label="Git"
          active={gitDrawerOpen}
          tooltip="Git"
          onClick={toggleGitDrawer}
        />
        <BarCell
          label=">_"
          active={shellDrawerOpen}
          tooltip="Shell"
          onClick={toggleShellDrawer}
        />
      </div>

      {/* Splits are tmux splits: they persist across a refresh, and are
          only meaningful once the terminal is attached to a session. */}
      <div className="flex items-stretch">
        <BarControl
          icon={SplitSquareHorizontal}
          tooltip="Split horizontal"
          disabled={!attachedTmux}
          onClick={() => splitPane("horizontal")}
        />
        <BarControl
          icon={SplitSquareVertical}
          tooltip="Split vertical"
          disabled={!attachedTmux}
          onClick={() => splitPane("vertical")}
        />
      </div>
    </div>
  );
}
