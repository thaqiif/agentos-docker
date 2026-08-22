"use client";

import { Keyboard, KeyboardOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeybarToggleButtonProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Floating button to toggle mobile keybar visibility.
 * Positioned at bottom-right of terminal, above the keybar when visible.
 */
export function KeybarToggleButton({
  isVisible,
  onToggle,
}: KeybarToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "absolute right-3 z-30",
        "flex h-11 w-11 items-center justify-center",
        "border-border-strong bg-surface border",
        "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        isVisible && "text-primary",
        "touch-manipulation transition-colors active:bg-accent",
        // Position: moves up when keyboard is visible (accounts for safe-area + taller keys + recent commands bar)
        isVisible
          ? "bottom-[265px]"
          : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
      )}
      aria-label={isVisible ? "Hide keyboard" : "Show keyboard"}
    >
      {isVisible ? (
        <KeyboardOff className="h-4 w-4" />
      ) : (
        <Keyboard className="h-4 w-4" />
      )}
    </button>
  );
}
