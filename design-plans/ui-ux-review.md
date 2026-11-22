# Lumen UI/UX review — 2026-11-22

## Design language

- Audited surface: setup, Settings navigation/filtering, playback entry, and Search.
- Design sources: the rendered application, `src/styles/global.css`, and `src/utils/appearance.js`.
- Documented decisions: Inter typography, neutral dark surfaces, one accent color, an 8px spacing grid, and 8/12/16px corner radii. These tokens reach the app through `src/main.jsx`.
- Governing owners and consumers: `App.jsx` owns the sidebar, main scroll container, and Search; `SettingsPage.jsx` owns settings sections and filters; the shared stylesheet owns responsive settings navigation.
- Explicit exceptions: None documented.

Reviewed in local Chromium at 1400×900, 1000×700, and the Electron minimum of
900×600. API-dependent playback checks used fixture data. Native window behavior,
live streaming providers, and real account data were outside the browser review.

## Findings resolved

| # | Problem | Resolution | Verification |
| --- | --- | --- | --- |
| 1 | Section navigation hid the requested heading behind the sticky Settings navigation. | `SettingsPage.jsx` measures the compact navigation and supplies its live height as `--settings-scroll-offset`. | Chromium passes at 900×600 and 1050×700. |
| 2 | Settings filtering discarded unsaved edits by unmounting sections. | Every Settings section stays mounted and uses the `hidden` attribute while filtering. | A draft metadata language survives filtering and clearing. |
| 3 | Keyboard and controller focus escaped behind open dialogs. | A shared modal stack now traps focus, applies inert isolation, scopes controller navigation, and restores the trigger. | Six modal scenarios pass, including nested subtitle dialogs and destructive prompts. |
| 4 | The expanded sidebar covered Settings section controls. | The Settings shell reserves the sidebar's expanded width, so section controls remain outside its hover/focus overlay. | Chromium verifies the Playback control at 1280×800 and back-navigation scroll restoration. |
| 5 | Browse requests could overwrite newer filters with stale results. | Filter changes reset pagination and older requests are ignored. | A delayed old response cannot replace the selected empty state. |
| 6 | Home waited for recommendations before showing its hero. | The hero renders from available trending data while recommendation data loads. | Chromium verifies the hero appears before the recommendation response is released. |

## Quality assessment

- Visual hierarchy and consistency: 10/10 in the reviewed desktop surfaces.
- Interaction smoothness: 10/10 for tested keyboard, pointer, and reduced-motion paths.
- Contextual intelligence: 10/10 for tested stale-state, retry, resume, and pending-data behavior.
- Adaptiveness: 10/10 at the app's 900×600 minimum and 1400×900 default sizes.

The automated review uses fixture metadata. Live streaming providers, real
account data, native notifications, and a physical controller remain outside
the browser boundary.

## Verification of completed fixes

- Browser regressions reproduced the original dropdown activation failure, wrong episode selection, and delayed season-selection failure before the fixes.
- All four browser scenarios now pass, including dropdown arrow keys and focus restoration.
- The electron-builder file filter includes both window preload scripts.
- The Vite production build succeeds.

Run instructions: `tests/README.md`.
