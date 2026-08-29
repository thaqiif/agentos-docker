import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const expectedTerminalCopy = [
  ["components/TerminalCard.tsx", /Delete terminal/i],
  ["components/QuickSwitcher.tsx", /Switch Terminal \/ Search Code/],
  ["components/QuickSwitcher.tsx", /Unnamed Terminal/],
  ["components/TmuxTerminals.tsx", /Tmux Terminals/],
  ["components/TerminalList/index.tsx", /group the terminals/i],
  ["components/TerminalList/KillAllConfirm.tsx", /Close every tmux terminal/i],
  [
    "components/Projects/ProjectSettingsDialog.tsx",
    /all terminals in this project/i,
  ],
  ["components/Projects/ProjectSettingsDialog.tsx", /new terminals/i],
  ["hooks/useProjects.ts", /Terminals will be moved/i],
  ["components/Terminal/hooks/websocket-connection.ts", /\[Terminal ended\]/],
  ["ideas.md", /tmux terminal linking/i],
  [
    "docs/issues/root-user-claude-skip-permissions.md",
    /terminals using Claude Code/i,
  ],
  [
    "docs/issues/ios-safari-websocket-reconnect.md",
    /tmux attach -t \{terminal\}/,
  ],
] as const;

test("product copy uses terminal terminology", () => {
  for (const [relativePath, pattern] of expectedTerminalCopy) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(source, pattern, `${relativePath} is missing ${pattern}`);
  }
});

test("product copy does not use the retired session terminology", () => {
  const files = [
    "components/TerminalCard.tsx",
    "components/QuickSwitcher.tsx",
    "components/TmuxTerminals.tsx",
    "components/TerminalList/index.tsx",
    "components/TerminalList/KillAllConfirm.tsx",
    "components/Projects/ProjectSettingsDialog.tsx",
    "hooks/useProjects.ts",
    "components/Terminal/hooks/websocket-connection.ts",
    "ideas.md",
    "docs/issues/root-user-claude-skip-permissions.md",
    "docs/issues/ios-safari-websocket-reconnect.md",
  ];
  const legacyCopy = [
    /Delete session/i,
    /Switch Session \/ Search Code/,
    /Unnamed Session/,
    /Tmux Sessions/,
    /group the sessions/i,
    /Close every tmux session/i,
    /all sessions in this project/i,
    /new sessions/i,
    /Sessions will be moved/i,
    /\[Session ended\]/,
    /tmux session linking/i,
    /sessions using Claude Code/i,
    /tmux attach -t \{session\}/,
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    for (const pattern of legacyCopy) {
      assert.doesNotMatch(
        source,
        pattern,
        `${relativePath} still contains ${pattern}`
      );
    }
  }
});

test("notification and waiting-alert surfaces are removed", () => {
  const removedFiles = [
    "lib/notifications.ts",
    "hooks/useNotifications.ts",
    "components/NotificationSettings.tsx",
    "hooks/useTerminalStatuses.ts",
    "data/statuses/queries.ts",
    "lib/status-detector.ts",
    "lib/status-hooks.ts",
    "lib/status-stream.ts",
    "app/api/terminals/status/route.ts",
    "app/api/terminals/status/stream/route.ts",
    "scripts/install-agent-hooks.sh",
    "scripts/hooks/agentos-status.sh",
    "scripts/hooks/agentos-codex-notify.sh",
  ];

  for (const relativePath of removedFiles) {
    assert.equal(
      existsSync(join(process.cwd(), relativePath)),
      false,
      `${relativePath} should be removed`
    );
  }

  const noAlertCopy = [
    ["app/page.tsx", /useNotifications|terminalStatuses|waiting for input/i],
    ["components/TerminalList/TerminalListHeader.tsx", /notifications|bell/i],
    ["components/TerminalCard.tsx", /tmuxStatus|status-waiting|waiting/i],
  ] as const;

  for (const [relativePath, pattern] of noAlertCopy) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.doesNotMatch(source, pattern, `${relativePath} retains alert code`);
  }
});

test("terminal surfaces use the terminal icon everywhere", () => {
  const terminalIconSurfaces = [
    ["components/Welcome.tsx", /Terminal as TerminalIcon/],
    ["components/QuickSwitcher.tsx", /import \{ Terminal,/],
    ["components/Pane/MobileTabBar.tsx", /Terminal as TerminalIcon/],
    ["components/TmuxTerminals.tsx", /RefreshCw, Terminal, MonitorUp/],
    ["components/views/WorkbenchBar.tsx", /label: "Terminal", icon: Terminal/],
    [
      "components/TerminalList/TerminalListHeader.tsx",
      /Terminal,\n\} from "lucide-react";/,
    ],
  ] as const;

  for (const [relativePath, pattern] of terminalIconSurfaces) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(
      source,
      pattern,
      `${relativePath} should use the terminal icon`
    );
  }

  const iconSources = ["app/icon.svg", "public/icon.svg"];
  for (const relativePath of iconSources) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(
      source,
      /m4 17 6-6-6/,
      `${relativePath} is not a terminal icon`
    );
    assert.match(source, /M12 19h8/, `${relativePath} is not a terminal icon`);
    assert.doesNotMatch(
      source,
      /M12 8V4H8/,
      `${relativePath} still uses the old icon`
    );
  }
});
