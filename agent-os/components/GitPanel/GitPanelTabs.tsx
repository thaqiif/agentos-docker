"use client";

import { cn } from "@/lib/utils";

export type GitTab = "changes" | "history";

interface GitPanelTabsProps {
  activeTab: GitTab;
  onTabChange: (tab: GitTab) => void;
}

const TABS: { id: GitTab; label: string }[] = [
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
];

export function GitPanelTabs({ activeTab, onTabChange }: GitPanelTabsProps) {
  return (
    <div className="bg-surface border-border flex shrink-0 items-stretch border-b">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative flex h-9 flex-1 items-center justify-center px-3 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors sm:flex-none",
            index > 0 && "border-l border-border",
            activeTab === tab.id
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
          )}
        </button>
      ))}
    </div>
  );
}
