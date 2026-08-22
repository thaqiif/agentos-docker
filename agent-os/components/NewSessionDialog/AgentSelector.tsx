import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { AgentType } from "@/lib/providers";
import { AGENT_OPTIONS } from "./NewSessionDialog.types";

interface AgentSelectorProps {
  value: AgentType;
  onChange: (value: AgentType) => void;
}

export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveFocus = (from: number, delta: number) => {
    const next = (from + delta + AGENT_OPTIONS.length) % AGENT_OPTIONS.length;
    const target = itemRefs.current[next];
    if (target) {
      target.focus();
      if (AGENT_OPTIONS[next].value !== value) {
        onChange(AGENT_OPTIONS[next].value);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="tech-label">01</span>
        <span className="tech-label">Agent</span>
      </div>
      <div
        role="radiogroup"
        aria-label="Agent"
        className="scrollbar-thin max-h-48 divide-y divide-border overflow-y-auto border border-border"
        onKeyDown={(e) => {
          const current = AGENT_OPTIONS.findIndex((o) => o.value === value);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            moveFocus(current, 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            moveFocus(current, -1);
          } else if (e.key === "Home") {
            e.preventDefault();
            moveFocus(current, -current);
          } else if (e.key === "End") {
            e.preventDefault();
            moveFocus(current, AGENT_OPTIONS.length - 1 - current);
          }
        }}
      >
        {AGENT_OPTIONS.map((option, index) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative flex w-full cursor-pointer items-center gap-2 py-1.5 pr-3 pl-4 text-left transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-inset",
                isActive
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "absolute top-0 bottom-0 left-0 w-0.5",
                  isActive ? "bg-primary" : "bg-transparent"
                )}
              />
              <span
                className={cn(
                  "size-1.5 shrink-0 border",
                  isActive
                    ? "border-primary bg-primary"
                    : "border-border-strong bg-transparent"
                )}
              />
              <span className="w-28 shrink-0 truncate font-mono text-[11px] tracking-[0.04em]">
                {option.label}
              </span>
              <span className="text-foreground-subtle truncate font-mono text-[10px]">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
