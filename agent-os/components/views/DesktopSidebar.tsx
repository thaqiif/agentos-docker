"use client";

import { useRef, useState } from "react";
import { TerminalList } from "@/components/TerminalList";
import { cn } from "@/lib/utils";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

// Delay before an unpinned, hover-revealed sidebar collapses again
const COLLAPSE_DELAY_MS = 300;

interface DesktopSidebarProps {
  isPinned: boolean;
  /** Notification bell, rendered into the sidebar header. */
  notifications?: React.ReactNode;
  onQuickSwitch?: () => void;
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
  notifications,
  onQuickSwitch,
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
  // looks so it is actually grabbable, but nothing is painted until it is
  // hovered — a permanent line would compete with the material's own edge.
  const resizeHandle = (
    <div
      onMouseDown={startResize}
      role="separator"
      aria-orientation="vertical"
      className={cn(
        "absolute top-0 right-0 z-50 h-full w-1 cursor-col-resize",
        "transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "after:absolute after:inset-y-0 after:-left-1 after:w-3 after:content-['']",
        isResizing ? "bg-primary/60" : "hover:bg-primary/35"
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
          notifications={notifications}
          onQuickSwitch={onQuickSwitch}
        />
      </div>
    </div>
  );

  if (isPinned) {
    // Pinned, the sidebar is part of the shell rather than something hovering
    // over it, so it is edge-lit down its inner edge rather than rimmed.
    return (
      <div
        style={{ width }}
        className={cn(
          "glass glass-edge-right relative z-20 flex-shrink-0 overflow-hidden",
          // No width transition while dragging, or the panel lags the cursor.
          !isResizing &&
            "transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
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
      {/* Unpinned it genuinely floats above the workbench, so it takes the
          thicker material and a depth shadow, and slides on the iOS curve. */}
      <div
        onMouseEnter={revealNow}
        onMouseLeave={scheduleCollapse}
        style={{ width }}
        className={cn(
          "glass-thick glass-float fixed top-0 left-0 z-40 h-full overflow-hidden",
          "transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          revealed ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
        {resizeHandle}
      </div>
    </>
  );
}
