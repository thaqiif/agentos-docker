import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const toolbarPath = "components/Terminal/TerminalToolbar.tsx";
const injectors = {
  keys: join(projectRoot, "patches/inject-terminal-toolbar-keys.mjs"),
  repeat: join(projectRoot, "patches/inject-toolbar-key-repeat.mjs"),
  uniform: join(projectRoot, "patches/inject-toolbar-uniform-buttons.mjs"),
};

const upstreamToolbar = `import { useCallback, useState } from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const SPECIAL_KEYS = {
  TAB: "\\t",
};

export function TerminalToolbar({ visible, onKeyPress }) {
  const [shiftActive, setShiftActive] = useState(false);
  const buttons = [
    { label: "Tab", key: SPECIAL_KEYS.TAB },
  ];

  if (!visible) return null;

  return (
    <div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setShiftActive((v) => !v);
          }}
          className="flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium"
        >
          ⇧
        </button>

      {buttons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onKeyPress(btn.key);
            }}
            className="flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium"
          >
            {btn.label}
          </button>
      ))}

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onKeyPress(shiftActive ? "\\n" : "\\r");
            setShiftActive(false);
          }}
          className="flex-shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium"
        >
          ↵
        </button>
    </div>
  );
}
`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "toolbar-injectors-"));
  const file = join(root, toolbarPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, upstreamToolbar);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, file };
}

function runInjector(script, root) {
  const result = spawnSync(process.execPath, [script, root], {
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `injector failed:\n${result.stdout}\n${result.stderr}`,
  );
}

function injectToolbar(root) {
  runInjector(injectors.keys, root);
  runInjector(injectors.uniform, root);
  runInjector(injectors.repeat, root);
}

async function renderGeneratedToolbar(t, onKeyPress) {
  const { root, file } = fixture(t);
  injectToolbar(root);

  const buildRoot = mkdtempSync(join(projectRoot, ".toolbar-runtime-"));
  const entry = join(buildRoot, "entry.tsx");
  const output = join(buildRoot, "component.cjs");
  t.after(() => rmSync(buildRoot, { recursive: true, force: true }));
  writeFileSync(
    entry,
    `export { TerminalToolbar } from ${JSON.stringify(file)};\n` +
      `export { runEffectCleanups } from "react";\n`,
  );
  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    format: "cjs",
    jsx: "automatic",
    logLevel: "silent",
    platform: "node",
    plugins: [
      {
        name: "mock-react-hooks",
        setup(build) {
          build.onResolve({ filter: /^react$/ }, () => ({
            namespace: "mock-react",
            path: "react",
          }));
          build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
            namespace: "mock-react",
            path: "jsx-runtime",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock-react" }, (args) => {
            if (args.path === "react") {
              return {
                contents:
                  `const cleanups = [];\n` +
                  `export const useCallback = (callback) => callback;\n` +
                  `export const useEffect = (effect) => {\n` +
                  `  const cleanup = effect();\n` +
                  `  if (typeof cleanup === "function") cleanups.push(cleanup);\n` +
                  `};\n` +
                  `export const useRef = (value) => ({ current: value });\n` +
                  `export const useState = (value) => [value, () => {}];\n` +
                  `export const runEffectCleanups = () => {\n` +
                  `  for (const cleanup of cleanups.splice(0)) cleanup();\n` +
                  `};\n`,
                loader: "js",
              };
            }
            return {
              contents:
                `export const Fragment = Symbol("Fragment");\n` +
                `export const jsx = (type, props, key) => ({ type, key, props });\n` +
                `export const jsxs = jsx;\n`,
              loader: "js",
            };
          });
        },
      },
    ],
  });

  delete require.cache[output];
  const { TerminalToolbar, runEffectCleanups } = require(output);
  const tree = TerminalToolbar({
    visible: true,
    onKeyPress,
  });
  t.after(runEffectCleanups);

  const textContent = (node) => {
    if (typeof node === "string") return node;
    if (!node || typeof node !== "object") return "";
    const children = node.props?.children;
    return (Array.isArray(children) ? children : [children])
      .map(textContent)
      .join("");
  };
  const buttons = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.type === "button") buttons.push(node);
    visit(node.props?.children);
  };
  visit(tree);

  return {
    button(label) {
      return buttons.find((node) => textContent(node) === label);
    },
  };
}

function withFakeTimers(run) {
  let nextId = 1;
  let now = 0;
  const tasks = new Map();
  const originals = {
    clearInterval: globalThis.clearInterval,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    setTimeout: globalThis.setTimeout,
  };

  const schedule = (callback, delay, interval) => {
    const id = nextId++;
    tasks.set(id, {
      callback,
      interval,
      time: now + delay,
    });
    return id;
  };
  globalThis.setTimeout = (callback, delay = 0) =>
    schedule(callback, delay, null);
  globalThis.setInterval = (callback, delay = 0) =>
    schedule(callback, delay, delay);
  globalThis.clearTimeout = (id) => tasks.delete(id);
  globalThis.clearInterval = (id) => tasks.delete(id);

  const clock = {
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const due = [...tasks.entries()]
          .filter(([, task]) => task.time <= target)
          .sort((a, b) => a[1].time - b[1].time || a[0] - b[0])[0];
        if (!due) break;

        const [id, task] = due;
        now = task.time;
        if (task.interval === null) {
          tasks.delete(id);
        }
        task.callback();
        if (task.interval !== null && tasks.has(id)) {
          task.time += task.interval;
        }
      }
      now = target;
    },
  };

  try {
    return run(clock);
  } finally {
    Object.assign(globalThis, originals);
  }
}

function primaryPointer(overrides = {}) {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    isPrimary: true,
    pointerId: 1,
    ...overrides,
  };
}

function click(detail = 1) {
  return {
    detail,
    stopPropagation() {},
  };
}

test("generates strictly typed key-repeat helpers", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const source = readFileSync(file, "utf8");

  assert.match(
    source,
    /const startKeyRepeat = useCallback\(\s*\(\s*key: string,/,
  );
  assert.doesNotMatch(source, /\(key\) =>/);
});

test("preserves click activation for pointer, keyboard, and assistive technology", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const source = readFileSync(file, "utf8");

  assert.match(
    source,
    /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*if \(e\.detail !== 0 && consumeSuppressedClick\(\)\) return;\s*onKeyPress\(btn\.key\);/,
  );
  assert.match(
    source,
    /onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*if \(e\.detail !== 0 && consumeSuppressedClick\(\)\) return;\s*onKeyPress\(shiftActive \? "\\n" : "\\r"\);/,
  );
});

test("keeps terminal focus when toolbar buttons are pressed", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const source = readFileSync(file, "utf8");

  assert.match(
    source,
    /startKeyRepeat\(btn\.key,[\s\S]*?onMouseDown=\{\(e\) => e\.preventDefault\(\)\}[\s\S]*?onClick=/,
  );
  assert.match(
    source,
    /startKeyRepeat\([\s\S]*?\(\) => setShiftActive\(false\)[\s\S]*?onMouseDown=\{\(e\) => e\.preventDefault\(\)\}[\s\S]*?onClick=/,
  );
});

test("ignores secondary and non-primary pointer presses", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const source = readFileSync(file, "utf8");

  assert.match(source, /if \(!e\.isPrimary \|\| e\.button !== 0\) return;/);
});

test("cancels repeat and suppresses click after a horizontal scroll gesture", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const source = readFileSync(file, "utf8");

  assert.match(source, /const KEY_REPEAT_MOVE_THRESHOLD = 10;/);
  assert.match(source, /Math\.hypot\(/);
  assert.match(source, /cancelKeyRepeat\(true\)/);
  assert.doesNotMatch(
    source,
    /onPointerDown=\{\(e\) => \{[^}]*onKeyPress\(/s,
  );
});

test("cleans up timeout and interval state on release, cancellation, and unmount", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const source = readFileSync(file, "utf8");

  assert.match(source, /clearTimeout\(keyRepeatTimerRef\.current\)/);
  assert.match(source, /clearInterval\(keyRepeatIntervalRef\.current\)/);
  assert.match(source, /useEffect\(\(\) => cleanupKeyRepeat, \[cleanupKeyRepeat\]\)/);
  assert.match(source, /onPointerUp=\{\(\) => \{\s*stopKeyRepeat\(\);/);
  assert.match(source, /onPointerCancel=\{\(\) => \{\s*cancelKeyRepeat\(true\);/);
});

test("the complete toolbar injector sequence is idempotent", (t) => {
  const { root, file } = fixture(t);
  injectToolbar(root);
  const once = readFileSync(file, "utf8");

  injectToolbar(root);

  assert.equal(readFileSync(file, "utf8"), once);
});

test("generated mapped and Enter buttons send exactly one key per tap", async (t) => {
  const sent = [];
  const toolbar = await renderGeneratedToolbar(t, (key) => sent.push(key));

  withFakeTimers(() => {
    const tab = toolbar.button("Tab");
    tab.props.onPointerDown(primaryPointer());
    tab.props.onPointerUp();
    tab.props.onClick(click());

    const enter = toolbar.button("↵");
    enter.props.onPointerDown(primaryPointer());
    enter.props.onPointerUp();
    enter.props.onClick(click());
  });

  assert.deepEqual(sent, ["\t", "\r"]);
});

test("generated buttons repeat after 300ms at a 50ms cadence and stop on release", async (t) => {
  const sent = [];
  const toolbar = await renderGeneratedToolbar(t, (key) => sent.push(key));

  withFakeTimers((clock) => {
    const tab = toolbar.button("Tab");
    tab.props.onPointerDown(primaryPointer());

    clock.advance(299);
    assert.deepEqual(sent, []);
    clock.advance(1);
    assert.deepEqual(sent, ["\t"]);
    clock.advance(100);
    assert.deepEqual(sent, ["\t", "\t", "\t"]);

    tab.props.onPointerUp();
    clock.advance(200);
    tab.props.onClick(click());
  });

  assert.deepEqual(sent, ["\t", "\t", "\t"]);
});

test("generated buttons send nothing after a horizontal scroll gesture", async (t) => {
  const sent = [];
  const toolbar = await renderGeneratedToolbar(t, (key) => sent.push(key));

  withFakeTimers((clock) => {
    const tab = toolbar.button("Tab");
    tab.props.onPointerDown(primaryPointer());
    tab.props.onPointerMove(primaryPointer({ clientX: 11 }));
    clock.advance(1_000);
    tab.props.onClick(click());
  });

  assert.deepEqual(sent, []);
});

test("generated click handlers remain keyboard and assistive-tech accessible", async (t) => {
  const sent = [];
  const toolbar = await renderGeneratedToolbar(t, (key) => sent.push(key));

  toolbar.button("Tab").props.onClick(click(0));
  toolbar.button("↵").props.onClick(click(0));

  assert.deepEqual(sent, ["\t", "\r"]);
});
