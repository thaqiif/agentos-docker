"use client";

import { useRef, useState } from "react";
import { TerminalList } from "@/components/TerminalList";
import { cn } from "@/lib/utils";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

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
  const { width, isResizing, startResize } = useSidebarWidth();
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

  // Drag handle sitting on the sidebar's right edge. It is wider than it
  // looks so it is actually grabbable, but only the 1px line is painted.
  const resizeHandle = (
    <div
      onMouseDown={startResize}
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "absolute top-0 right-0 z-50 h-full w-1 cursor-col-resize transition-colors",
        "after:absolute after:inset-y-0 after:-left-1 after:w-3 after:content-['']",
        isResizing ? "bg-primary/50" : "hover:bg-primary/30"
      )}
    />
  );

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
    </div>
  );

  if (isPinned) {
    return (
      <div
        style={{ width }}
        className={cn(
          "bg-sidebar-background border-sidebar-border relative flex-shrink-0 overflow-hidden border-r",
          // No width transition while dragging, or the panel lags the cursor.
          !isResizing && "transition-[width] duration-200"
        )}
      >
        {content}
        {resizeHandle}
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
        style={{ width }}
        className={cn(
          "bg-sidebar-background border-sidebar-border fixed top-0 left-0 z-40 h-full overflow-hidden border-r transition-transform duration-200 ease-out",
          revealed ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
        {resizeHandle}
      </div>
    </>
  );
}
