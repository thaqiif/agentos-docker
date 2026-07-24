# Changelog

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
