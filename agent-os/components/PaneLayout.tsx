"use client";

import { Fragment } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import type { PaneLayout as PaneLayoutType } from "@/lib/panes";
import { usePanes } from "@/contexts/PaneContext";
import { cn } from "@/lib/utils";

interface PaneLayoutProps {
  layout: PaneLayoutType;
  renderPane: (paneId: string) => React.ReactNode;
}

function LayoutRenderer({ layout, renderPane }: PaneLayoutProps) {
  if (layout.type === "leaf") {
    return <>{renderPane(layout.paneId)}</>;
  }

  const orientation = layout.direction;

  return (
    <Group orientation={orientation} className="h-full">
      {layout.children.map((child, index) => (
        <Fragment key={child.type === "leaf" ? child.paneId : index}>
          <Panel
            defaultSize={layout.sizes[index]}
            minSize={15}
            className="h-full"
          >
            <LayoutRenderer layout={child} renderPane={renderPane} />
          </Panel>
          {index < layout.children.length - 1 && (
            <Separator
              className={cn(
                "bg-border hover:bg-primary/60 active:bg-primary relative transition-colors",
                orientation === "horizontal"
                  ? "w-px cursor-col-resize before:absolute before:inset-y-0 before:-inset-x-1 before:content-['']"
                  : "h-px cursor-row-resize before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']"
              )}
            />
          )}
        </Fragment>
      ))}
    </Group>
  );
}

export function PaneLayout({
  renderPane,
}: {
  renderPane: (paneId: string) => React.ReactNode;
}) {
  const { state, isMobile, focusedPaneId } = usePanes();

  // On mobile: only render the focused pane (single pane mode)
  if (isMobile) {
    return <div className="h-full w-full">{renderPane(focusedPaneId)}</div>;
  }

  // On desktop: render full layout tree with splits
  return (
    <div className="h-full w-full">
      <LayoutRenderer layout={state.layout} renderPane={renderPane} />
    </div>
  );
}
