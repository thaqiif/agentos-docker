"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clipboard,
  X,
  Send,
  Mic,
  MicOff,
  Paperclip,
  FileText,
  Plus,
  Trash2,
  MousePointer2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// ANSI escape sequences
const SPECIAL_KEYS = {
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  ESC: "\x1b",
  TAB: "\t",
  SHIFT_TAB: "\x1b[Z",
  NEWLINE: "\x1b\r",
  CTRL_C: "\x03",
  CTRL_D: "\x04",
  CTRL_Z: "\x1a",
  CTRL_L: "\x0c",
} as const;

interface TerminalToolbarProps {
  onKeyPress: (key: string) => void;
  onFilePicker?: () => void;
  onCopy?: () => boolean; // Returns true if selection was copied
  selectMode?: boolean;
  onSelectModeChange?: (enabled: boolean) => void;
  visible?: boolean;
}

interface Snippet {
  id: string;
  name: string;
  content: string;
}

const SNIPPETS_STORAGE_KEY = "terminal-snippets";

const DEFAULT_SNIPPETS: Snippet[] = [
  // Git shortcuts
  { id: "default-1", name: "Git status", content: "git status" },
  { id: "default-2", name: "Git diff", content: "git diff" },
  { id: "default-3", name: "Git add all", content: "git add -A" },
  { id: "default-4", name: "Git commit", content: 'git commit -m ""' },
  { id: "default-5", name: "Git push", content: "git push" },
  { id: "default-6", name: "Git pull", content: "git pull" },
  // Claude Code prompts
  { id: "default-7", name: "Continue", content: "continue" },
  { id: "default-8", name: "Yes", content: "yes" },
  { id: "default-9", name: "No", content: "no" },
  {
    id: "default-10",
    name: "Explain this",
    content: "explain what this code does",
  },
  { id: "default-11", name: "Fix errors", content: "fix the errors" },
  {
    id: "default-12",
    name: "Run tests",
    content: "run the tests and fix any failures",
  },
  {
    id: "default-13",
    name: "Commit changes",
    content: "commit these changes with a descriptive message",
  },
  // Common commands
  { id: "default-14", name: "List files", content: "ls -la" },
  { id: "default-15", name: "NPM dev", content: "npm run dev" },
  { id: "default-16", name: "NPM install", content: "npm install" },
];

function getStoredSnippets(): Snippet[] {
  if (typeof window === "undefined") return DEFAULT_SNIPPETS;
  try {
    const stored = localStorage.getItem(SNIPPETS_STORAGE_KEY);
    if (!stored) {
      // First time - save defaults
      saveSnippets(DEFAULT_SNIPPETS);
      return DEFAULT_SNIPPETS;
    }
    return JSON.parse(stored);
  } catch {
    return DEFAULT_SNIPPETS;
  }
}

function saveSnippets(snippets: Snippet[]) {
  localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
}

// Snippets modal for saving/inserting common commands
function SnippetsModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
}) {
  const [snippets, setSnippets] = useState<Snippet[]>(() =>
    getStoredSnippets()
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleAdd = () => {
    if (newName.trim() && newContent.trim()) {
      const newSnippet: Snippet = {
        id: Date.now().toString(),
        name: newName.trim(),
        content: newContent.trim(),
      };
      const updated = [...snippets, newSnippet];
      setSnippets(updated);
      saveSnippets(updated);
      setNewName("");
      setNewContent("");
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    saveSnippets(updated);
  };

  const handleInsert = (content: string) => {
    onInsert(content);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-popover border-border-strong flex max-h-[70vh] w-full flex-col border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
          <span className="tech-label">//snippets</span>
          <div className="flex items-center">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-1.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Add new snippet form */}
        {isAdding && (
          <div className="border-border bg-surface border-b px-4 py-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Snippet name..."
              className="border-border bg-background placeholder:text-foreground-subtle focus:border-primary focus:ring-primary mb-2 w-full border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Command or text..."
              className="border-border bg-background placeholder:text-foreground-subtle focus:border-primary focus:ring-primary h-20 w-full resize-none border px-3 py-2 font-mono text-xs focus:ring-1 focus:outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newContent.trim()}
              className="border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 mt-2 w-full border py-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              Save Snippet
            </button>
          </div>
        )}

        {/* Snippets list */}
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {snippets.length === 0 ? (
            <div className="text-muted-foreground px-4 py-8 text-center font-mono text-xs">
              No snippets yet. Tap + to add one.
            </div>
          ) : (
            snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="border-border active:bg-accent/50 flex items-center gap-2 border-b px-4 py-3"
              >
                <button
                  onClick={() => handleInsert(snippet.content)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-foreground truncate text-xs font-medium">
                    {snippet.name}
                  </div>
                  <div className="text-muted-foreground truncate font-mono text-xs">
                    {snippet.content}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(snippet.id)}
                  className="text-muted-foreground hover:bg-destructive/20 hover:text-destructive p-2 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Paste modal for when clipboard API isn't available
function PasteModal({
  open,
  onClose,
  onPaste,
}: {
  open: boolean;
  onClose: () => void;
  onPaste: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text) {
      onPaste(text);
      setText("");
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-popover border-border-strong w-[90%] max-w-md border p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="tech-label">//paste</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData?.getData("text");
            if (pasted) {
              e.preventDefault();
              setText((prev) => prev + pasted);
            }
          }}
          placeholder="Tap here, then long-press to paste..."
          autoFocus
          className="border-border bg-background placeholder:text-foreground-subtle focus:border-primary focus:ring-primary h-24 w-full resize-none border px-3 py-2 font-mono text-xs focus:ring-1 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!text}
          className="border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 mt-3 flex w-full items-center justify-center gap-2 border py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          Send to Terminal
        </button>
      </div>
    </div>
  );
}

export function TerminalToolbar({
  onKeyPress,
  onFilePicker,
  onCopy,
  selectMode = false,
  onSelectModeChange,
  visible = true,
}: TerminalToolbarProps) {
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showSnippetsModal, setShowSnippetsModal] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Send text character-by-character to terminal
  const sendText = useCallback(
    (text: string) => {
      for (const char of text) {
        onKeyPress(char);
      }
    },
    [onKeyPress]
  );

  const {
    isListening,
    isSupported: isMicSupported,
    toggle: toggleMic,
  } = useSpeechRecognition(sendText);

  // Handle paste - try clipboard API first, fall back to modal
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard?.readText?.();
      if (text) {
        sendText(text);
        return;
      }
    } catch {
      // Clipboard API failed or unavailable
    }
    setShowPasteModal(true);
  }, [sendText]);

  // Handle copy with visual feedback
  const handleCopy = useCallback(() => {
    if (onCopy?.()) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1000);
    }
  }, [onCopy]);

  // Ctrl modifier: when armed, the next physical keystroke is sent as a
  // control character (Ctrl+A..Z and @ [ \\ ] ^ _ ?). Captured at the window
  // level so it works with the native keyboard; mobile soft keyboards may
  // not emit keydown, which is why the on-screen ^C/^D buttons remain.
  useEffect(() => {
    if (!ctrlActive) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "Control" || k === "Shift" || k === "Alt" || k === "Meta")
        return;
      e.preventDefault();
      e.stopPropagation();
      if (k.length === 1) {
        if (k === " ") onKeyPress("\x00");
        else if (k === "?") onKeyPress("\x7f");
        else {
          const c = k.toUpperCase().charCodeAt(0);
          if (c >= 64 && c <= 95) onKeyPress(String.fromCharCode(c & 0x1f));
        }
      }
      setCtrlActive(false);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [ctrlActive, onKeyPress]);

  // Alt/Option modifier: when armed, the next physical key is sent ESC-
  // prefixed (Meta). The main use is Alt+Enter -> "\x1b\r", which Claude
  // Code inserts as a newline instead of submitting; also Alt+b / Alt+f for
  // word navigation. Same window-level capture as the Ctrl modifier.
  useEffect(() => {
    if (!altActive) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "Control" || k === "Shift" || k === "Alt" || k === "Meta")
        return;
      e.preventDefault();
      e.stopPropagation();
      if (k === "Enter") onKeyPress("\x1b\r");
      else if (k.length === 1) onKeyPress("\x1b" + k);
      setAltActive(false);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [altActive, onKeyPress]);

  // Keep taps as native clicks for keyboard/assistive-tech support. A
  // stationary pointer hold starts typematic repeat after 300ms; moving
  // 10px cancels before any key is sent so horizontal scrolling is safe.
  const KEY_REPEAT_MOVE_THRESHOLD = 10;
  const keyRepeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRepeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keyRepeatPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const keyRepeatStartActionRef = useRef<(() => void) | null>(null);
  const suppressKeyRepeatClickRef = useRef(false);
  const cleanupKeyRepeat = useCallback(() => {
    if (keyRepeatTimerRef.current !== null) {
      clearTimeout(keyRepeatTimerRef.current);
      keyRepeatTimerRef.current = null;
    }
    if (keyRepeatIntervalRef.current !== null) {
      clearInterval(keyRepeatIntervalRef.current);
      keyRepeatIntervalRef.current = null;
    }
    keyRepeatPointerRef.current = null;
    keyRepeatStartActionRef.current = null;
  }, []);
  useEffect(() => cleanupKeyRepeat, [cleanupKeyRepeat]);
  const startKeyRepeat = useCallback(
    (
      key: string,
      pointerId: number,
      clientX: number,
      clientY: number,
      onRepeatStart?: () => void
    ) => {
      cleanupKeyRepeat();
      suppressKeyRepeatClickRef.current = false;
      keyRepeatPointerRef.current = { pointerId, startX: clientX, startY: clientY };
      keyRepeatStartActionRef.current = onRepeatStart ?? null;
      keyRepeatTimerRef.current = setTimeout(() => {
        keyRepeatTimerRef.current = null;
        if (!keyRepeatPointerRef.current) return;
        suppressKeyRepeatClickRef.current = true;
        keyRepeatStartActionRef.current?.();
        keyRepeatStartActionRef.current = null;
        onKeyPress(key);
        keyRepeatIntervalRef.current = setInterval(() => onKeyPress(key), 50);
      }, 300);
    },
    [cleanupKeyRepeat, onKeyPress]
  );
  const stopKeyRepeat = useCallback(() => {
    cleanupKeyRepeat();
  }, [cleanupKeyRepeat]);
  const cancelKeyRepeat = useCallback(
    (suppressClick: boolean) => {
      if (suppressClick && keyRepeatPointerRef.current) {
        suppressKeyRepeatClickRef.current = true;
      }
      cleanupKeyRepeat();
    },
    [cleanupKeyRepeat]
  );
  const trackKeyRepeatPointer = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const pointer = keyRepeatPointerRef.current;
      if (!pointer || pointer.pointerId !== pointerId) return;
      if (
        Math.hypot(clientX - pointer.startX, clientY - pointer.startY) >=
        KEY_REPEAT_MOVE_THRESHOLD
      ) {
        cancelKeyRepeat(true);
      }
    },
    [cancelKeyRepeat]
  );
  const consumeSuppressedClick = useCallback(() => {
    const suppress = suppressKeyRepeatClickRef.current;
    suppressKeyRepeatClickRef.current = false;
    return suppress;
  }, []);

  if (!visible) return null;

  const buttons = [
    { label: "Esc", key: SPECIAL_KEYS.ESC },
    { label: "^C", key: SPECIAL_KEYS.CTRL_C, highlight: true },
    { label: "Tab", key: SPECIAL_KEYS.TAB },
    { label: "⇧Tab", key: SPECIAL_KEYS.SHIFT_TAB },
    { label: "↵ NL", key: SPECIAL_KEYS.NEWLINE },
    { label: "←", key: SPECIAL_KEYS.LEFT },
    { label: "→", key: SPECIAL_KEYS.RIGHT },
    { label: "↑", key: SPECIAL_KEYS.UP },
    { label: "↓", key: SPECIAL_KEYS.DOWN },
  ];

  return (
    <>
      <PasteModal
        open={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onPaste={sendText}
      />
      <SnippetsModal
        open={showSnippetsModal}
        onClose={() => setShowSnippetsModal(false)}
        onInsert={sendText}
      />
      <div
        className="bg-surface border-border scrollbar-none flex items-stretch overflow-x-auto border-t"
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Mic button */}
        {isMicSupported && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMic();
            }}
            className={cn(
              "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 transition-colors",
              isListening
                ? "animate-pulse text-destructive"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {isListening && (
              <span className="bg-destructive absolute inset-x-0 bottom-0 h-px" />
            )}
          </button>
        )}

        {/* Paste button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            handlePaste();
          }}
          className="text-muted-foreground hover:bg-accent/50 hover:text-foreground relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 transition-colors"
        >
          <Clipboard className="h-4 w-4" />
        </button>

        {/* Select mode toggle */}
        {onSelectModeChange && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onSelectModeChange(!selectMode);
            }}
            className={cn(
              "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 transition-colors",
              selectMode
                ? "text-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <MousePointer2 className="h-4 w-4" />
            {selectMode && (
              <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
            )}
          </button>
        )}

        {/* Copy button - shown when in select mode */}
        {selectMode && onCopy && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className={cn(
              "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 transition-colors",
              copyFeedback
                ? "text-status-running"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Copy className="h-4 w-4" />
          </button>
        )}

        {/* File picker button */}
        {onFilePicker && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onFilePicker();
            }}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 transition-colors"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        )}

        {/* Snippets button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setShowSnippetsModal(true);
          }}
          className="text-muted-foreground hover:bg-accent/50 hover:text-foreground relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 transition-colors"
        >
          <FileText className="h-4 w-4" />
        </button>

        {/* Shift toggle */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setShiftActive(!shiftActive);
          }}
          className={cn(
            "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 font-mono text-sm transition-colors",
            shiftActive
              ? "text-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          ⇧
          {shiftActive && (
            <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
          )}
        </button>

        {/* Ctrl modifier toggle - next physical key becomes a control char */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setCtrlActive((v) => !v);
          }}
          className={cn(
            "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 font-mono text-sm transition-colors",
            ctrlActive
              ? "text-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          ⌃
          {ctrlActive && (
            <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
          )}
        </button>

        {/* Alt modifier toggle - next physical key is sent ESC-prefixed (Meta) */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setAltActive((v) => !v);
          }}
          className={cn(
            "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 font-mono text-sm transition-colors",
            altActive
              ? "text-primary"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          ⌥
          {altActive && (
            <span className="bg-primary absolute inset-x-0 bottom-0 h-px" />
          )}
        </button>

        {/* Enter key - sends \n if shift active, \r otherwise */}
        <button
          type="button"
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0) return;
            const key = shiftActive ? "\n" : "\r";
            startKeyRepeat(
              key,
              e.pointerId,
              e.clientX,
              e.clientY,
              () => setShiftActive(false)
            );
          }}
          onPointerMove={(e) => {
            trackKeyRepeatPointer(e.pointerId, e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            stopKeyRepeat();
          }}
          onPointerLeave={() => {
            cancelKeyRepeat(true);
          }}
          onPointerCancel={() => {
            cancelKeyRepeat(true);
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            if (e.detail !== 0 && consumeSuppressedClick()) return;
            onKeyPress(shiftActive ? "\n" : "\r");
            setShiftActive(false);
          }}
          className="text-muted-foreground hover:bg-accent/50 hover:text-foreground active:bg-accent active:text-foreground relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 font-mono text-sm transition-colors"
        >
          ↵
        </button>

        {/* Special keys */}
        {buttons.map((btn) => (
          <button
            type="button"
            key={btn.label}
            onPointerDown={(e) => {
              if (!e.isPrimary || e.button !== 0) return;
              startKeyRepeat(btn.key, e.pointerId, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              trackKeyRepeatPointer(e.pointerId, e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              stopKeyRepeat();
            }}
            onPointerLeave={() => {
              cancelKeyRepeat(true);
            }}
            onPointerCancel={() => {
              cancelKeyRepeat(true);
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.detail !== 0 && consumeSuppressedClick()) return;
              onKeyPress(btn.key);
            }}
            className={cn(
              "relative flex min-w-[3.25rem] shrink-0 items-center justify-center border-r border-border px-2 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
              "hover:bg-accent/50 active:bg-accent active:text-foreground",
              btn.highlight
                ? "text-destructive"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </>
  );
}
