# Changelog

## 2026-08-22

### Changed

- Redesigned the AgentOS workbench UI around a Command Code-inspired
  cyber-industrial language: near-black canvas, 1px-border architecture,
  2px geometry, JetBrains Mono metadata, `//section` tech labels, zero-padded
  indexes, and restrained burple accents (~90% monochrome).
- Restyled session/project rows, tabs, mode strips, Quick Switcher, file
  explorer, Git panels/drawer/diffs, shell drawer, dev servers, worker
  conductor, dialogs, pickers, toasts, terminal chrome, and mobile sidebar as
  flat bordered rows and technical panels (no floating cards or heavy shadows).
- Mapped all status colors to theme tokens (running/waiting/info/error) and
  extended the workbench tokens to every light and dark theme variant.
- Replaced raw palette classes, oversized radii, and legacy shadows throughout
  the component tree; popovers now use minimal radius with subtle elevation.

### Fixed

- Repaired a corrupted `ABadge.tsx` that broke `tsc --noEmit`.
- Added missing workbench CSS tokens to eight theme variants where surfaces
  would have rendered transparent.
- Restored ARIA radio keyboard semantics (roving tabindex, arrow keys) in the
  agent selector after its Select-to-radiogroup conversion.
- Preserved mobile touch targets in the file tree (44px) and code search rows.

## 2026-07-24

### Added

- Hold-to-repeat behavior for mobile terminal key buttons, with gesture
  cancellation for safe horizontal toolbar scrolling.
- Regression tests for toolbar injector typing, accessibility, focus retention,
  pointer handling, timer cleanup, and idempotency.

### Changed

- Increased mobile toolbar button height for more comfortable touch targets.

### Fixed

- Preserved keyboard and assistive-technology activation for repeating keys.
- Kept terminal focus when toolbar buttons are pressed.
- Made the toolbar injector chain idempotent after adding the React `useRef`
  import.
