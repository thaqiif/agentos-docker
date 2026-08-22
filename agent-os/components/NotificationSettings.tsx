"use client";

import { Bell, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NotificationSettings as NotificationSettingsType } from "@/lib/notifications";

interface WaitingSession {
  id: string;
  name: string;
}

interface NotificationSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: NotificationSettingsType;
  permissionGranted: boolean;
  waitingSessions?: WaitingSession[];
  onUpdateSettings: (settings: Partial<NotificationSettingsType>) => void;
  onRequestPermission: () => Promise<boolean>;
  onSelectSession?: (id: string) => void;
}

export function NotificationSettings({
  open,
  onOpenChange,
  settings,
  permissionGranted,
  waitingSessions = [],
  onUpdateSettings,
  onRequestPermission,
  onSelectSession,
}: NotificationSettingsProps) {
  const waitingCount = waitingSessions.length;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell
            className={cn(
              "h-4 w-4",
              !settings.sound && "text-muted-foreground"
            )}
          />
          {waitingCount > 0 && (
            <span className="bg-status-waiting absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full font-mono text-[10px] font-bold text-background">
              {waitingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Waiting sessions section */}
        {waitingCount > 0 && (
          <>
            <DropdownMenuLabel className="tech-label flex items-center gap-2 text-status-waiting">
              <AlertCircle className="h-3 w-3" />
              Waiting for input
            </DropdownMenuLabel>
            <div className="divide-y divide-border">
              {waitingSessions.map((session) => (
                <DropdownMenuItem
                  key={session.id}
                  onClick={() => {
                    onSelectSession?.(session.id);
                    onOpenChange(false);
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 animate-status-pulse bg-status-waiting" />
                  <span className="truncate font-mono text-xs">
                    {session.name}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Sound toggle */}
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm">
            {settings.sound ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="text-muted-foreground h-4 w-4" />
            )}
            Sound
          </span>
          <Switch
            checked={settings.sound}
            onCheckedChange={(checked) => onUpdateSettings({ sound: checked })}
            aria-label="Toggle notification sound"
          />
        </div>

        {/* Browser notifications - only show if not granted */}
        {!permissionGranted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await onRequestPermission();
              }}
            >
              <Bell className="h-4 w-4" />
              <span>Enable browser alerts</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
