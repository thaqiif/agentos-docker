# Changelog

## 2026-08-24

### Changed

- Redesigned the entire AgentOS workbench using Apple's Liquid Glass design
  language: translucent chrome surfaces with backdrop blur, specular highlights,
  and physics-based motion, replacing the previous flat-bordered cyber-industrial
  aesthetic.
- Established a complete Liquid Glass design system (`styles/liquid-glass.css`,
  `docs/liquid-glass.md`) with four material thickness tiers (ultrathin → thin
  → regular → thick), optical effects (backdrop blur, saturation, specular
  highlights, edge fades, optional refraction), and iOS radii/spacing scales.
- Implemented Apple typography conventions: SF Pro typefaces with negative
  tracking on large sizes, tightening as scale grows, and the full `type-*`
  utility ramp (`type-title-1` through `type-caption-2`).
- Rewrote motion system with spring physics (1.0/0.4 for repositions, 0.8/0.3
  for sheets, 0.25/0 for controls), rubber-banding, momentum projection, and
  `prefers-reduced-motion` graceful degradation.
- Added three mandatory accessibility fallbacks to every glass surface: near-solid
  fills when `backdrop-filter` is unsupported or `prefers-reduced-transparency:
  reduce`, and explicit borders for `prefers-contrast: more`.
- Migrated global shell (desktop sidebar, command strip, mobile tab bar) and all
  shared UI components (buttons, badges, menus, dialogs, sheets, inputs, switches,
  tooltips, toasts, skeletons) to the Liquid Glass material and type system.
- Redesigned 40+ feature surfaces including terminals, file explorer, Git panels/
  drawer/diffs, shell drawer, Quick Switcher, projects list, dev server dialogs,
  theme picker, PR creation modal, welcome screen, and mobile swipe sidebar with
  direct-manipulation physics.
- Converted machine notation (`pr.create`, `diff.idle`, `GIT CLEAN`, zero-padded
  indexes, dotted micro-labels) to natural language sentences and title-case
  eyebrows throughout the application.
- Replaced all `border-border`/`divide-border` hairlines with the `--fill-*`
  opacity scale (fill-1 through fill-4) to avoid harsh 1px dividers on glass.
- Removed uppercase spaced tracking from all metadata and section labels; replaced
  with system-face `ui-label` (0.6875rem, weight 590, tracking .045em, uppercase)
  for section eyebrows and `ui-meta` (mono 0.6875rem) for machine values.
- Enforced the glass layering rule application-wide: chrome (navigation, toolbars,
  menus, transient surfaces) is glass; content (terminals, editors, diffs, file
  trees) stays opaque with explicit `bg-background`.
- Updated 16 theme variants in `styles/themes.css` to derive all new tokens
  (glass materials, specular highlights, rim shadows, elevation, fills) from
  existing HSL triplets with zero duplication.
- Verified full build succeeds and new classes reach the CSS output; glass
  components at layer 25415, utilities at 31346 so `bg-*` can override material.

### Added

- `lib/spring.ts`: spring physics engine with `setTarget` mid-flight retargeting,
  `VelocityTracker`, `projectMomentum`, `rubberBand`, `prefersReducedMotion`.
- `components/a/ASurface.tsx`: single abstraction for material selection
  (ultrathin/thin/regular/thick/solid/raised), edge lighting, float elevation,
  and rounding.
- `components/a/AEmptyState.tsx`: unified empty/error state component replacing
  hand-rolled `❯ retry` / `sessions 000` patterns.

### Fixed

- Corrected Tailwind v4 cascade by moving all glass classes into `@layer
  components` so utility classes can override them.
- Removed orphaned `--grid-line` variable from all theme blocks after
  `workbench-grid` was replaced by `ambient-canvas`.
- Fixed broken class strings where earlier sweeps had created double-space
  artifacts or malformed utility combinations.
- Repaired duplicated closing div tags in ServerLogsModal and StartServerDialog
  that broke the build.

## 2026-08-22 (2)
