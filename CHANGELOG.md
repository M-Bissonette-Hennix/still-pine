# Changelog

## 1.2.0 — Foundation Hardening
- Replaced interval-accumulated practice timing with an absolute session clock that reconstructs the correct phase after iOS/browser suspension and excludes paused wall-clock time.
- Added truthful operational session provenance for scheduled duration, actual elapsed practice time, pack version, and manual phase navigation.
- Rebuilt the service worker with request-aware caching, navigation-only HTML fallback, legacy v1.1 migration, and deferred managed updates that do not interrupt an active sitting.
- Added strict practice-pack validation: unique stage IDs, cue bounds/order, exact substep duration totals, safe same-origin image paths, image alt text, and structural size limits.
- Brought the formal zenpack schema and pack-authoring documentation into parity with image-aware stages/substeps.
- Isolated repository-pack failures so one malformed/unavailable pack cannot prevent other valid curricula from loading.
- Added local backup/restore, persistent-storage requests, storage status, and privacy-safe diagnostics.
- Added capability-aware vibration settings, stronger settings/practice dialog focus isolation, screen-reader announcements only for meaningful practice changes, visible focus treatment, reduced-motion support, and iPhone safe-area refinements.
- Added release validation, unit tests, GitHub Actions validation, release checklists, and Foundation I/kuji provenance guards.
- Added `.nojekyll` to make the GitHub Pages static deployment intent explicit.
- Preserved Foundation I curriculum text, timings, and all nine user-supplied kuji images byte-for-byte from v1.1.0.

## 1.1.0
- Added guided visual display for all nine kuji-in seals during the Kuji Threshold phase.
- Bundled the user-supplied seal diagrams inside the app under `assets/kuji/`.
- Updated the Foundation I repository pack to include per-seal image references.
- Preloads practice visuals at session start for smoother in-session transitions.

## 1.0.0 — Foundation I

- Initial Still Pine PWA.
- Modular `.zenpack.json` curriculum format.
- Foundation I guided daily form.
- Full-screen phase timer and kuji substeps.
- Optional transition bell, vibration, and wake lock.
- Reading Room and local Markdown/text reader.
- Local one-sentence post-sit record and Dharma inquiry.
- GitHub Pages and pack-authoring documentation.
