"use client";

import { useRef, useState } from "react";
import { TerminalList } from "@/components/TerminalList";
import { SidebarFooter } from "@/components/SidebarFooter";
import { cn } from "@/lib/utils";

// Delay before an unpinned, hover-revealed sidebar collapses again
const COLLAPSE_DELAY_MS = 300;

interface DesktopSidebarProps {
  isPinned: boolean;
  togglePin: () => void;
  activeSessionId?: string;
  terminalStatuses: React.ComponentProps<typeof TerminalList>["terminalStatuses"];
  onSelect: (name: string) => void;
  onNewTerminal: (projectId?: string) => void;
  onCloseTerminal: (projectId: string) => void;
  onStartDevServer: (projectId: string) => void;
  onCreateDevServer: React.ComponentProps<
    typeof TerminalList
  >["onCreateDevServer"];
}

export function DesktopSidebar({
  isPinned,
  togglePin,
  activeSessionId,
  terminalStatuses,
  onSelect,
  onNewTerminal,
  onCloseTerminal,
  onStartDevServer,
  onCreateDevServer,
}: DesktopSidebarProps) {
  // When unpinned, the sidebar floats and reveals on hover near the left edge
  const [revealed, setRevealed] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCollapse = () => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };
  const scheduleCollapse = () => {
    cancelCollapse();
    collapseTimer.current = setTimeout(
      () => setRevealed(false),
      COLLAPSE_DELAY_MS
    );
  };
  const revealNow = () => {
    cancelCollapse();
    setRevealed(true);
  };

  const content = (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <TerminalList
          activeSessionId={activeSessionId}
          terminalStatuses={terminalStatuses}
          onSelect={onSelect}
          onNewTerminal={onNewTerminal}
          onCloseTerminal={onCloseTerminal}
          onStartDevServer={onStartDevServer}
          onCreateDevServer={onCreateDevServer}
          pinControls={{ isPinned, onTogglePin: togglePin }}
        />
      </div>
      <SidebarFooter />
    </div>
  );

  if (isPinned) {
    return (
      <div className="bg-sidebar-background border-sidebar-border w-60 flex-shrink-0 overflow-hidden border-r transition-all duration-200">
        {content}
      </div>
    );
  }

  return (
    <>
      {/* Hover trigger strip on the left edge reveals the floating sidebar */}
      <div
        className="fixed top-0 left-0 z-30 h-full w-2"
        onMouseEnter={revealNow}
      />
      <div
        onMouseEnter={revealNow}
        onMouseLeave={scheduleCollapse}
        className={cn(
          "bg-sidebar-background border-sidebar-border fixed top-0 left-0 z-40 h-full w-60 overflow-hidden border-r transition-transform duration-200 ease-out",
          revealed ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </div>
    </>
  );
}
