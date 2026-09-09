# Still Pine v1.2.0 — Foundation Hardening

**Release date:** 2026-09-08  
**Baseline:** `M-Bissonette-Hennix/still-pine@26187ec7a15d29ec17ef107c84517b4811df5620`  
**Runtime architecture:** static HTML/CSS/JavaScript/JSON, no runtime dependencies

## Purpose

v1.2.0 makes the existing Still Pine practice companion substantially more trustworthy without changing the prescribed Foundation I curriculum. It closes timer, PWA-update, offline-fallback, pack-validation, local-data, accessibility, and release-engineering weaknesses identified in the v1.1.0 audit.

## Principal changes

- Absolute-session practice clock reconstructs the correct stage after iOS/browser suspension and excludes paused time.
- Completion records preserve actual elapsed practice time separately from scheduled duration and record manual phase navigation.
- Request-aware service worker: navigation-only HTML fallback, versioned caches, content/runtime separation, and managed updates.
- One-time legacy v1.1 cache migration into the managed-update architecture.
- Strict `.zenpack.json` runtime validation and per-pack repository fault isolation.
- Safe same-origin visual-path enforcement prevents imported packs from introducing remote tracking images.
- Formal schema/docs now describe image-aware practice stages and substeps.
- Local backup/restore, persistent-storage request, storage status, and privacy-safe diagnostics.
- Capability-aware vibration settings, reduced-motion support, stronger modal focus isolation, screen-reader cue announcements, and iPhone safe-area hardening.
- Automated release validator, unit tests, GitHub Actions validation, provenance guards, and device acceptance checklist.

## Curriculum preservation

Foundation I remains **25m30s** with exact stage durations **180 / 90 / 300 / 900 / 60 seconds**. The Foundation I JSON and all nine kuji reference images are byte-identical to the v1.1.0 baseline. The release validator stores and checks their SHA-256 values so accidental spiritual-content drift fails the build.

## Upgrade behavior

The old v1.1.0 service worker used a cache named `still-pine-v1.1.0`. v1.2.0 recognizes that exact legacy cache and performs a one-time automatic activation so an already-installed Home Screen PWA can cross into the new managed-update architecture. Subsequent v1.2+ service-worker updates wait for explicit application activation and are held while Practice Mode is active.

## Remaining acceptance gate

The source and mocked lifecycle tests are complete. The final acceptance step is intentionally device-level: deploy the package to GitHub Pages, launch the already-installed iPhone PWA from v1.1.0, verify the upgrade, then verify an offline relaunch. See `docs/RELEASE-CHECKLIST.md`.

No release should claim that final device gate before it has actually been performed.
