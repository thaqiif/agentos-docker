"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  NotificationSettings,
  NotificationEvent,
  defaultSettings,
  loadSettings,
  saveSettings,
  requestNotificationPermission,
  canSendBrowserNotification,
  sendBrowserNotification,
  playNotificationSound,
  setTabNotificationCount,
  flashTabTitle,
  clearTabNotifications,
} from "@/lib/notifications";

type SessionStatus = "idle" | "running" | "waiting" | "done" | "error" | "dead";

interface SessionState {
  id: string;
  name: string;
  status: SessionStatus;
}

interface UseNotificationsOptions {
  onSessionClick?: (sessionId: string) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { onSessionClick } = options;
  const [settings, setSettings] =
    useState<NotificationSettings>(defaultSettings);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const previousStates = useRef<Map<string, SessionStatus>>(new Map());
  const waitingCount = useRef(0);
  /** Last outcome announced per session, cleared when it starts running. */
  const lastNotifiedStatus = useRef<Map<string, SessionStatus>>(new Map());

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings());
    setPermissionGranted(canSendBrowserNotification());
  }, []);

  // Request permission, and say what happened. Silent failure here was the
  // main reason "enable browser alerts" looked broken: a denied or
  // non-secure origin produced no prompt and no message.
  const requestPermission = useCallback(async () => {
    const outcome = await requestNotificationPermission();
    setPermissionGranted(outcome === "granted");

    switch (outcome) {
      case "granted":
        toast.success("Browser alerts enabled", {
          description: "Sending a test notification now.",
        });
        sendBrowserNotification(
          "AgentOS alerts are on",
          {
            body: "You'll be notified when a session needs input or finishes.",
          },
          undefined,
          true
        );
        break;
      case "denied":
        toast.error("Browser alerts are blocked", {
          description:
            "Your browser has denied notifications for this site. Re-allow them in the site settings next to the address bar.",
        });
        break;
      case "dismissed":
        toast.warning("Permission dismissed", {
          description: "Choose Allow when the browser asks to enable alerts.",
        });
        break;
      case "insecure-context":
        toast.error("Browser alerts need HTTPS", {
          description:
            "Notifications are disabled on plain http origins. Use https or reach AgentOS via localhost.",
        });
        break;
      case "unsupported":
        toast.error("Browser alerts unavailable", {
          description: "This browser does not support notifications.",
        });
        break;
    }

    return outcome === "granted";
  }, []);

  // Update settings
  const updateSettings = useCallback(
    (newSettings: Partial<NotificationSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        saveSettings(updated);
        return updated;
      });
    },
    []
  );

  // Toggle a specific event
  const toggleEvent = useCallback(
    (event: NotificationEvent, enabled: boolean) => {
      setSettings((prev) => {
        const updated = {
          ...prev,
          events: { ...prev.events, [event]: enabled },
        };
        saveSettings(updated);
        return updated;
      });
    },
    []
  );

  // Send notification for an event
  const notify = useCallback(
    (
      event: NotificationEvent,
      sessionId: string,
      sessionName: string,
      message?: string
    ) => {
      if (!settings.enabled || !settings.events[event]) return;

      const titles: Record<NotificationEvent, string> = {
        waiting: `${sessionName} needs input`,
        error: `${sessionName} encountered an error`,
        completed: `${sessionName} completed`,
      };

      const title = titles[event];
      const body = message || getDefaultMessage(event);

      // In-app toast with click action
      const toastTypes: Record<
        NotificationEvent,
        "warning" | "error" | "success"
      > = {
        waiting: "warning",
        error: "error",
        completed: "success",
      };
      toast[toastTypes[event]](title, {
        description: body,
        action: {
          label: "Go to session",
          onClick: () => onSessionClick?.(sessionId),
        },
      });

      // Browser notification (only if page not focused)
      if (settings.browserNotifications && permissionGranted) {
        sendBrowserNotification(
          title,
          { body, tag: `agentos-${event}-${sessionName}` },
          () => onSessionClick?.(sessionId)
        );
      }

      // Sound
      if (settings.sound) {
        playNotificationSound(event);
      }

      // Flash tab title
      if (event === "waiting") {
        flashTabTitle(`Waiting: ${sessionName}`);
      }
    },
    [settings, permissionGranted, onSessionClick]
  );

  // Check for state changes and notify
  const checkStateChanges = useCallback(
    (sessions: SessionState[], activeSessionId?: string | null) => {
      if (!settings.enabled) return;

      let newWaitingCount = 0;

      sessions.forEach((session) => {
        const prevStatus = previousStates.current.get(session.id);
        const currentStatus = session.status;

        // Tab badge counts anything wanting attention: blocked on input, or
        // finished and not yet looked at.
        if (currentStatus === "waiting" || currentStatus === "done") {
          newWaitingCount++;
        }

        // Skip if no previous state (initial load)
        if (prevStatus === undefined) {
          previousStates.current.set(session.id, currentStatus);
          return;
        }

        // Skip if status unchanged
        if (prevStatus === currentStatus) return;

        // Skip notifications for the currently active/focused session
        if (session.id === activeSessionId) {
          previousStates.current.set(session.id, currentStatus);
          return;
        }

        // One notification per session per episode.
        //
        // An "episode" is a stretch of work: it opens when the session goes
        // running and closes when we have announced its outcome. Keying off
        // the previous status alone was not enough — switching sessions
        // re-keys the status query, and a replayed snapshot then looked like
        // a fresh transition, so the same "done" fired again every time the
        // user moved between sessions.
        if (currentStatus === "running") {
          lastNotifiedStatus.current.delete(session.id);
        } else if (
          currentStatus === "waiting" ||
          currentStatus === "error" ||
          currentStatus === "done"
        ) {
          const alreadyAnnounced =
            lastNotifiedStatus.current.get(session.id) === currentStatus;

          if (!alreadyAnnounced) {
            lastNotifiedStatus.current.set(session.id, currentStatus);
            notify(
              currentStatus === "done" ? "completed" : currentStatus,
              session.id,
              session.name
            );
          }
        }

        previousStates.current.set(session.id, currentStatus);
      });

      // Update tab badge
      if (newWaitingCount !== waitingCount.current) {
        waitingCount.current = newWaitingCount;
        setTabNotificationCount(newWaitingCount);
      }
    },
    [settings.enabled, notify]
  );

  // Clear notifications when focused
  useEffect(() => {
    const handleFocus = () => {
      // Don't clear count, just stop flashing
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // User returned to tab
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTabNotifications();
    };
  }, []);

  return {
    settings,
    permissionGranted,
    requestPermission,
    updateSettings,
    toggleEvent,
    notify,
    checkStateChanges,
  };
}

function getDefaultMessage(event: NotificationEvent): string {
  switch (event) {
    case "waiting":
      return "Session is waiting for your input";
    case "error":
      return "Something went wrong";
    case "completed":
      return "Task has finished";
  }
}
