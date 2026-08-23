"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Mic,
  MicOff,
  Clipboard,
  X,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKeyRepeat } from "@/hooks/useKeyRepeat";

// ANSI escape sequences
const SPECIAL_KEYS = {
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  ENTER: "\r",
  ESC: "\x1b",
  TAB: "\t",
  BACKSPACE: "\x7f",
  CTRL_C: "\x03",
  CTRL_D: "\x04",
  CTRL_Z: "\x1a",
  CTRL_L: "\x0c",
} as const;

// Keyboard layouts
const ROWS = {
  numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  numbersShift: ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  row1: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  row2: ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  row3: ["z", "x", "c", "v", "b", "n", "m"],
  symbols: ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
  symbolsMore: [".", ",", "?", "!", "'", "`", "~", "=", "+", "*"],
};

type KeyboardMode = "quick" | "abc" | "num";

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onImagePick?: () => void;
  visible?: boolean;
}

// Track last touch time globally to prevent duplicate events from touch->mouse emulation
let lastTouchTime = 0;

// Event delegation handler - finds the key from data attribute and fires callback
function createKeyboardHandler(onKey: (key: string) => void) {
  const handleEvent = (e: TouchEvent | MouseEvent) => {
    // Find the button with data-key attribute
    const target = e.target as HTMLElement;
    const button = target.closest("[data-key]") as HTMLElement | null;
    if (!button) return;

    const key = button.getAttribute("data-key");
    if (!key) return;

    e.preventDefault();

    // Prevent duplicate from touch->mouse emulation
    if (e.type === "touchstart") {
      lastTouchTime = Date.now();
    } else if (e.type === "mousedown" && Date.now() - lastTouchTime < 500) {
      return;
    }

    onKey(key);
  };

  return handleEvent;
}

// Simple key button - no individual handlers, uses event delegation
// Memoized to prevent re-renders when parent state changes (like shift)
const Key = memo(function Key({
  char,
  dataKey,
  className,
}: {
  char: string;
  dataKey?: string;
  className?: string;
}) {
  return (
    <button
      data-key={dataKey ?? char}
      className={cn(
        "border-border bg-surface-raised text-foreground active:bg-accent flex h-[44px] flex-1 touch-manipulation items-center justify-center border font-mono text-xs",
        "min-w-[32px] select-none",
        className
      )}
    >
      {char}
    </button>
  );
});

// Fast button for special keys (uses event delegation via data-key)
function FastKey({
  dataKey,
  className,
  children,
}: {
  dataKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button data-key={dataKey} className={className}>
      {children}
    </button>
  );
}

// Fast button with direct handler (for shortcuts bar which is outside main keyboard delegation)
function FastButton({
  onPress,
  className,
  children,
}: {
  onPress: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    lastTouchTime = Date.now();
    onPress();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTime < 500) return;
    e.preventDefault();
    onPress();
  };

  return (
    <button
      onTouchStart={handleTouchStart}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
    >
      {children}
    </button>
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when modal opens
  useCallback(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-popover border-border-strong w-full max-w-lg border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="tech-label">paste</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // Handle paste event directly
            const pasted = e.clipboardData?.getData("text");
            if (pasted) {
              e.preventDefault();
              setText((prev) => prev + pasted);
            }
          }}
          placeholder="Tap here, then long-press to paste..."
          autoFocus
          inputMode="text"
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

// Terminal shortcuts bar - common keys for terminal interaction
function TerminalShortcutsBar({
  onKeyPress,
  isListening,
  onMicToggle,
  isMicSupported,
}: {
  onKeyPress: (key: string) => void;
  isListening?: boolean;
  onMicToggle?: () => void;
  isMicSupported?: boolean;
}) {
  const [showPasteModal, setShowPasteModal] = useState(false);

  const shortcuts = [
    { label: "Esc", key: SPECIAL_KEYS.ESC },
    { label: "^C", key: SPECIAL_KEYS.CTRL_C, highlight: true },
    { label: "Tab", key: SPECIAL_KEYS.TAB },
    { label: "^D", key: SPECIAL_KEYS.CTRL_D },
    { label: "^Z", key: SPECIAL_KEYS.CTRL_Z },
    { label: "^L", key: SPECIAL_KEYS.CTRL_L },
    { label: "↑", key: SPECIAL_KEYS.UP },
    { label: "↓", key: SPECIAL_KEYS.DOWN },
  ];

  // Handle paste - try clipboard API first, fall back to modal
  const handlePaste = useCallback(async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          for (const char of text) {
            onKeyPress(char);
          }
          return;
        }
      }
    } catch {
      // Clipboard API failed, show modal
    }
    // Fall back to modal
    setShowPasteModal(true);
  }, [onKeyPress]);

  // Handle paste from modal
  const handleModalPaste = useCallback(
    (text: string) => {
      for (const char of text) {
        onKeyPress(char);
      }
    },
    [onKeyPress]
  );

  return (
    <>
      <PasteModal
        open={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onPaste={handleModalPaste}
      />
      <div className="border-border scrollbar-none flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
        {/* Paste button */}
        <FastButton
          onPress={handlePaste}
          className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex-shrink-0 touch-manipulation border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase select-none"
        >
          <Clipboard className="h-3.5 w-3.5" />
        </FastButton>
        {/* Mic button - always visible when supported */}
        {isMicSupported && onMicToggle && (
          <FastButton
            onPress={onMicToggle}
            className={cn(
              "border-border bg-surface-raised flex-shrink-0 touch-manipulation border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase select-none",
              isListening
                ? "animate-pulse text-destructive"
                : "text-muted-foreground active:bg-accent active:text-foreground"
            )}
          >
            {isListening ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </FastButton>
        )}
        {shortcuts.map((shortcut) => (
          <FastButton
            key={shortcut.label}
            onPress={() => onKeyPress(shortcut.key)}
            className={cn(
              "border-border bg-surface-raised active:bg-accent active:text-foreground flex-shrink-0 touch-manipulation border px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase select-none",
              shortcut.highlight
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {shortcut.label}
          </FastButton>
        ))}
      </div>
    </>
  );
}

export function VirtualKeyboard({
  onKeyPress,
  onImagePick,
  visible = true,
}: VirtualKeyboardProps) {
  const [mode, setMode] = useState<KeyboardMode>("abc");
  const [shifted, setShifted] = useState(false);
  const keyboardRef = useRef<HTMLDivElement>(null);

  // Speech recognition - send transcript directly to terminal
  const handleTranscript = useCallback(
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
  } = useSpeechRecognition(handleTranscript);

  // Key repeat for backspace
  const handleBackspace = useCallback(() => {
    onKeyPress(SPECIAL_KEYS.BACKSPACE);
  }, [onKeyPress]);
  const { startRepeat: startBackspace, stopRepeat: stopBackspace } =
    useKeyRepeat(handleBackspace);

  // Event delegation - attach once, handle all keys
  useEffect(() => {
    const el = keyboardRef.current;
    if (!el) return;

    const handleKey = (key: string) => {
      // Handle special keys
      if (key === "SHIFT") {
        setShifted((s) => !s);
        return;
      }
      if (key === "MODE_ABC") {
        setMode("abc");
        return;
      }
      if (key === "MODE_NUM") {
        setMode("num");
        return;
      }
      if (key === "MODE_QUICK") {
        setMode("quick");
        return;
      }
      if (key === "SPACE") {
        onKeyPress(" ");
        return;
      }
      if (key === "ENTER") {
        onKeyPress(SPECIAL_KEYS.ENTER);
        return;
      }
      if (key === "LEFT") {
        onKeyPress(SPECIAL_KEYS.LEFT);
        return;
      }
      if (key === "RIGHT") {
        onKeyPress(SPECIAL_KEYS.RIGHT);
        return;
      }
      if (key === "UP") {
        onKeyPress(SPECIAL_KEYS.UP);
        return;
      }
      if (key === "DOWN") {
        onKeyPress(SPECIAL_KEYS.DOWN);
        return;
      }
      if (key === "IMAGE" && onImagePick) {
        onImagePick();
        return;
      }

      // Regular character - apply shift if needed
      const char = shifted ? key.toUpperCase() : key;
      onKeyPress(char);
      if (shifted) setShifted(false);
    };

    const handler = createKeyboardHandler(handleKey);

    el.addEventListener("touchstart", handler, { passive: false });
    el.addEventListener("mousedown", handler);
    el.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      el.removeEventListener("touchstart", handler);
      el.removeEventListener("mousedown", handler);
    };
  }, [onKeyPress, shifted, onImagePick]);

  if (!visible) return null;

  // Quick mode - just essential terminal keys
  if (mode === "quick") {
    return (
      <div
        ref={keyboardRef}
        className="bg-surface border-border flex flex-col select-none border-t"
      >
        {/* Terminal shortcuts */}
        <TerminalShortcutsBar
          onKeyPress={onKeyPress}
          isListening={isListening}
          onMicToggle={toggleMic}
          isMicSupported={isMicSupported}
        />

        <div className="flex flex-col gap-1.5 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {/* Mode tabs + common keys */}
          <div className="flex gap-1">
            <FastKey
              dataKey="MODE_ABC"
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] flex-1 touch-manipulation items-center justify-center border font-mono text-xs uppercase select-none"
            >
              ABC
            </FastKey>
            <FastKey
              dataKey="MODE_NUM"
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] flex-1 touch-manipulation items-center justify-center border font-mono text-xs uppercase select-none"
            >
              123
            </FastKey>
            {onImagePick && (
              <FastKey
                dataKey="IMAGE"
                className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[44px] touch-manipulation items-center justify-center border select-none"
              >
                <ImagePlus className="h-4 w-4" />
              </FastKey>
            )}
            <div className="flex-1" />
            <button
              onTouchStart={startBackspace}
              onTouchEnd={stopBackspace}
              onTouchCancel={stopBackspace}
              onMouseDown={startBackspace}
              onMouseUp={stopBackspace}
              onMouseLeave={stopBackspace}
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[56px] touch-manipulation items-center justify-center border font-mono text-sm select-none"
            >
              ⌫
            </button>
          </div>

          {/* Arrow keys + Enter */}
          <div className="flex gap-1">
            <FastKey
              dataKey="LEFT"
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[44px] touch-manipulation items-center justify-center border select-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </FastKey>
            <div className="flex flex-col gap-1">
              <FastKey
                dataKey="UP"
                className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[20px] w-[44px] touch-manipulation items-center justify-center border select-none"
              >
                <ChevronUp className="h-3 w-3" />
              </FastKey>
              <FastKey
                dataKey="DOWN"
                className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[20px] w-[44px] touch-manipulation items-center justify-center border select-none"
              >
                <ChevronDown className="h-3 w-3" />
              </FastKey>
            </div>
            <FastKey
              dataKey="RIGHT"
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[44px] touch-manipulation items-center justify-center border select-none"
            >
              <ChevronRight className="h-4 w-4" />
            </FastKey>
            <div className="flex-1" />
            <Key
              char="⏎"
              dataKey="ENTER"
              className="border-primary/40 text-primary w-[68px]"
            />
          </div>
        </div>
      </div>
    );
  }

  // ABC mode - full QWERTY
  if (mode === "abc") {
    return (
      <div
        ref={keyboardRef}
        className="bg-surface border-border flex flex-col select-none border-t"
      >
        {/* Terminal shortcuts */}
        <TerminalShortcutsBar
          onKeyPress={onKeyPress}
          isListening={isListening}
          onMicToggle={toggleMic}
          isMicSupported={isMicSupported}
        />

        <div className="flex flex-col gap-1.5 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {/* QWERTY rows */}
          <div className="flex gap-1">
            {ROWS.row1.map((char) => (
              <Key
                key={char}
                char={shifted ? char.toUpperCase() : char}
                dataKey={char}
              />
            ))}
          </div>
          <div className="flex gap-1 px-4">
            {ROWS.row2.map((char) => (
              <Key
                key={char}
                char={shifted ? char.toUpperCase() : char}
                dataKey={char}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <FastKey
              dataKey="SHIFT"
              className={cn(
                "flex h-[44px] w-[48px] touch-manipulation items-center justify-center border font-mono text-sm select-none",
                shifted
                  ? "border-primary/60 bg-primary/10 text-primary active:bg-accent active:text-foreground"
                  : "border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground"
              )}
            >
              ⇧
            </FastKey>
            {ROWS.row3.map((char) => (
              <Key
                key={char}
                char={shifted ? char.toUpperCase() : char}
                dataKey={char}
              />
            ))}
            <button
              onTouchStart={startBackspace}
              onTouchEnd={stopBackspace}
              onTouchCancel={stopBackspace}
              onMouseDown={startBackspace}
              onMouseUp={stopBackspace}
              onMouseLeave={stopBackspace}
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[48px] touch-manipulation items-center justify-center border font-mono text-sm select-none"
            >
              ⌫
            </button>
          </div>

          {/* Bottom row */}
          <div className="flex gap-1">
            <FastKey
              dataKey="MODE_QUICK"
              className="border-border bg-surface-raised text-destructive active:bg-accent flex h-[44px] w-[56px] touch-manipulation items-center justify-center border font-mono text-xs uppercase select-none"
            >
              ^C
            </FastKey>
            <FastKey
              dataKey="MODE_NUM"
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[48px] touch-manipulation items-center justify-center border font-mono text-xs uppercase select-none"
            >
              123
            </FastKey>
            <FastKey
              dataKey="SPACE"
              className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] flex-1 touch-manipulation items-center justify-center border font-mono text-xs select-none"
            >
              space
            </FastKey>
            <FastKey
              dataKey="ENTER"
              className="border-primary/40 bg-primary/10 text-primary active:bg-accent active:text-foreground flex h-[44px] w-[68px] touch-manipulation items-center justify-center border font-mono text-xs select-none"
            >
              ⏎
            </FastKey>
          </div>
        </div>
      </div>
    );
  }

  // Num mode - numbers and symbols
  return (
    <div
      ref={keyboardRef}
      className="bg-surface border-border flex flex-col select-none border-t"
    >
      {/* Terminal shortcuts */}
      <TerminalShortcutsBar
        onKeyPress={onKeyPress}
        isListening={isListening}
        onMicToggle={toggleMic}
        isMicSupported={isMicSupported}
      />

      <div className="flex flex-col gap-1.5 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {/* Number row */}
        <div className="flex gap-1">
          {ROWS.numbers.map((char) => (
            <Key key={char} char={char} />
          ))}
        </div>

        {/* Symbols rows */}
        <div className="flex gap-1">
          {ROWS.symbols.map((char) => (
            <Key key={char} char={char} />
          ))}
        </div>
        <div className="flex gap-1">
          {ROWS.symbolsMore.map((char) => (
            <Key key={char} char={char} />
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex gap-1">
          <FastKey
            dataKey="MODE_QUICK"
            className="border-border bg-surface-raised text-destructive active:bg-accent flex h-[44px] w-[56px] touch-manipulation items-center justify-center border font-mono text-xs uppercase select-none"
          >
            ^C
          </FastKey>
          <FastKey
            dataKey="MODE_ABC"
            className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[48px] touch-manipulation items-center justify-center border font-mono text-xs uppercase select-none"
          >
            ABC
          </FastKey>
          <FastKey
            dataKey="SPACE"
            className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] flex-1 touch-manipulation items-center justify-center border font-mono text-xs select-none"
          >
            space
          </FastKey>
          <button
            onTouchStart={startBackspace}
            onTouchEnd={stopBackspace}
            onTouchCancel={stopBackspace}
            onMouseDown={startBackspace}
            onMouseUp={stopBackspace}
            onMouseLeave={stopBackspace}
            className="border-border bg-surface-raised text-muted-foreground active:bg-accent active:text-foreground flex h-[44px] w-[48px] touch-manipulation items-center justify-center border font-mono text-sm select-none"
          >
            ⌫
          </button>
          <FastKey
            dataKey="ENTER"
            className="border-primary/40 bg-primary/10 text-primary active:bg-accent active:text-foreground flex h-[44px] w-[68px] touch-manipulation items-center justify-center border font-mono text-xs select-none"
          >
            ⏎
          </FastKey>
        </div>
      </div>
    </div>
  );
}
