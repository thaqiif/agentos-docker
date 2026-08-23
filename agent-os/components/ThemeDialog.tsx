"use client";

import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DARK_THEMES,
  LIGHT_THEMES,
  parseTheme,
  buildTheme,
  type ThemeOption,
  type DarkThemeVariant,
  type LightThemeVariant,
} from "@/lib/theme-config";
import { cn } from "@/lib/utils";

interface ThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Swatch({ preview }: { preview: ThemeOption["preview"] }) {
  return (
    <span
      className="border-border flex h-5 w-8 shrink-0 items-center justify-center gap-0.5 border"
      style={{ background: preview.background }}
    >
      <span
        className="h-2 w-2"
        style={{ background: preview.foreground }}
        aria-hidden
      />
      <span
        className="h-2 w-2"
        style={{ background: preview.accent }}
        aria-hidden
      />
    </span>
  );
}

function ThemeRow({
  label,
  description,
  preview,
  active,
  onClick,
}: {
  label: string;
  description?: string;
  preview?: ThemeOption["preview"];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 py-2 pr-4 pl-3 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-accent/50"
      )}
    >
      {active && <span className="bg-primary absolute inset-y-0 left-0 w-0.5" />}
      {preview ? <Swatch preview={preview} /> : <span className="w-8" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-tight">{label}</span>
        {description && (
          <span className="tech-meta mt-0.5 block truncate">{description}</span>
        )}
      </span>
      {active && <Check className="text-primary h-3 w-3 shrink-0" />}
    </button>
  );
}

/**
 * Theme picker.
 *
 * This was a hover submenu, which meant every theme you tried closed the
 * menu and you reopened it to try the next one. A dialog stays put: pick as
 * many as you like and dismiss it with Esc or a click outside when the one
 * on screen is the one you want.
 */
export function ThemeDialog({ open, onOpenChange }: ThemeDialogProps) {
  const { theme, setTheme } = useTheme();
  const { mode, variant } = parseTheme(theme || "system");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden border-border-strong bg-popover p-0 shadow-md sm:max-w-md"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Theme</DialogTitle>
        </DialogHeader>

        <div className="border-border flex h-9 shrink-0 items-center border-b px-4">
          <span className="tech-label">theme</span>
        </div>

        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          <ThemeRow
            label="System"
            description="Follow the operating system"
            active={mode === "system"}
            onClick={() => setTheme("system")}
          />

          <div className="border-border border-t px-4 py-1.5">
            <span className="tech-label">dark</span>
          </div>
          {DARK_THEMES.map((t) => (
            <ThemeRow
              key={t.id}
              label={t.label}
              description={t.description}
              preview={t.preview}
              active={mode === "dark" && (variant ?? "deep") === t.id}
              onClick={() =>
                setTheme(buildTheme("dark", t.id as DarkThemeVariant))
              }
            />
          ))}

          <div className="border-border border-t px-4 py-1.5">
            <span className="tech-label">light</span>
          </div>
          {LIGHT_THEMES.map((t) => (
            <ThemeRow
              key={t.id}
              label={t.label}
              description={t.description}
              preview={t.preview}
              active={mode === "light" && (variant ?? "default") === t.id}
              onClick={() =>
                setTheme(buildTheme("light", t.id as LightThemeVariant))
              }
            />
          ))}
        </div>

        <div className="border-border flex items-center justify-between border-t px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.12em] text-foreground-subtle uppercase">
            esc close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
