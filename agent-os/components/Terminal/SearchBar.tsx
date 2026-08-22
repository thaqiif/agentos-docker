"use client";

import { forwardRef } from "react";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  visible: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onClose: () => void;
  matchCount?: number;
  matchTotal?: number;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      visible,
      query,
      onQueryChange,
      onFindNext,
      onFindPrevious,
      onClose,
      matchCount,
      matchTotal,
    },
    ref
  ) => {
    if (!visible) return null;

    return (
      <div
        className={cn(
          "border-border bg-popover flex items-center gap-1 border-b px-3",
          "focus-within:ring-primary focus-within:ring-1 focus-within:ring-inset"
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search in terminal..."
          className={cn(
            "placeholder:text-foreground-subtle min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-foreground",
            "focus:outline-none"
          )}
        />
        {matchTotal !== undefined && (
          <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            {matchCount ?? 0}/{matchTotal}
          </span>
        )}
        <div className="flex items-stretch">
          <button
            onClick={onFindPrevious}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-2 transition-colors"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onFindNext}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-2 transition-colors"
            title="Next (Enter)"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-2 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";
