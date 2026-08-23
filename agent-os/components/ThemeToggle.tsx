"use client";

import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DARK_THEMES,
  LIGHT_THEMES,
  parseTheme,
  buildTheme,
  type DarkThemeVariant,
  type LightThemeVariant,
} from "@/lib/theme-config";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { mode, variant } = parseTheme(theme || "system");
  const currentValue =
    mode === "system"
      ? "system"
      : variant && variant !== "default" && variant !== "deep"
        ? `${mode}:${variant}`
        : mode;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 font-mono"
          aria-label="Change theme"
        >
          <span className="text-muted-foreground font-mono text-[10px] tracking-[0.08em] uppercase">
            <span suppressHydrationWarning>{currentValue}</span>
          </span>
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Light Themes */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="h-4 w-4" />
            <span>Light</span>
            {mode === "light" && (
              <Check className="text-primary ml-auto h-4 w-4" />
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="scrollbar-thin max-h-[50vh] w-56 overflow-y-auto">
            <DropdownMenuLabel className="tech-label">
              //light themes
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LIGHT_THEMES.map((lightTheme) => {
              const isActive = mode === "light" && variant === lightTheme.id;
              return (
                <DropdownMenuItem
                  key={lightTheme.id}
                  onClick={() =>
                    setTheme(
                      buildTheme("light", lightTheme.id as LightThemeVariant)
                    )
                  }
                  className="cursor-pointer"
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm">{lightTheme.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {lightTheme.description}
                    </span>
                  </div>
                  {isActive && (
                    <Check className="text-primary ml-auto h-4 w-4 shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Dark Themes */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Moon className="h-4 w-4" />
            <span>Dark</span>
            {mode === "dark" && (
              <Check className="text-primary ml-auto h-4 w-4" />
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="scrollbar-thin max-h-[50vh] w-56 overflow-y-auto">
            <DropdownMenuLabel className="tech-label">
              //dark themes
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DARK_THEMES.map((darkTheme) => {
              const isActive = mode === "dark" && variant === darkTheme.id;
              return (
                <DropdownMenuItem
                  key={darkTheme.id}
                  onClick={() =>
                    setTheme(
                      buildTheme("dark", darkTheme.id as DarkThemeVariant)
                    )
                  }
                  className="cursor-pointer"
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm">{darkTheme.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {darkTheme.description}
                    </span>
                  </div>
                  {isActive && (
                    <Check className="text-primary ml-auto h-4 w-4 shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* System Theme */}
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4" />
          <span>System</span>
          {mode === "system" && (
            <Check className="text-primary ml-auto h-4 w-4" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
