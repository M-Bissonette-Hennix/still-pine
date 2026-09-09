# Still Pine — Sōtō Practice Companion

Still Pine is a small, local-first, installable web application for guided daily zazen, modular practice curricula, post-sit inquiry, and Zen study.

**Still Pine is an independent personal practice tool. It is not an official product of Sōtō Zen Buddhism or any temple, teacher, or lineage.**

The application deliberately separates software orchestration from spiritual authority: curriculum content is supplied by the user's spiritual-development workflow; Still Pine implements that curriculum faithfully.

## Current practice

The bundled Foundation I form is unchanged in v1.2.0:

kuji threshold → entering zazen → susokukan → shikantaza → closing form

The kuji sequence remains explicitly labeled as a personal pre-zazen threshold rather than orthodox Sōtō liturgy.

## Core capabilities

- Full-screen guided timer with automatic phase transitions
- Absolute session timing that reconciles correctly after browser/iOS suspension
- Nine timed kuji substeps with bundled user-supplied visual references
- Generated transition bell, capability-aware vibration, and Wake Lock support
- Modular `.zenpack.json` curriculum packages with strict local validation
- Per-pack fault isolation when loading repository curricula
- One-sentence local sitting notes without ratings, scores, streaks, or badges
- Post-zazen Dharma inquiry
- Reading Room with official-source links and local study notes
- Local `.txt` / `.md` reader for personal texts
- Request-aware PWA/offline cache
- Safe deferred application updates
- Local backup/restore and persistent-storage support
- Privacy-safe diagnostic reports
- No runtime dependencies, accounts, trackers, analytics, ads, server, or build step

## Product principle

Still Pine should become more capable **around** practice and less intrusive **during** practice. It is not a quantified-self meditation product. The application carries procedural burden so the practitioner can practice.

## Run locally

Serve the repository directory rather than opening `index.html` directly:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Validate a release

Node is used only for development validation, not by the deployed application:

```bash
node scripts/validate.mjs
node --test tests/*.test.mjs
```

## GitHub Pages

See [`docs/GITHUB-PAGES.md`](docs/GITHUB-PAGES.md).

## Practice packs

See [`docs/PACK-AUTHORING.md`](docs/PACK-AUTHORING.md).

## Reading texts

The repository does not copy modern copyrighted Zen translations merely for convenience. Where appropriate it links to authoritative external sources and can ship original study notes. Your own legally obtained `.txt` or `.md` files can be opened locally without uploading them anywhere.

## Privacy

Still Pine is local-first. Practice notes, settings, backups, and imported packs are not sent to a remote service by the application. There is no telemetry or advertising layer.

## Safety / physical practice

Do not use posture as an endurance test. Sharp pain, persistent numbness, or circulation problems are reasons to adjust carefully. Stable alternatives such as seiza support, a zafu, or a chair may be used according to the user's practice instruction.

## Release assurance

Release validation is intentionally separate from the runtime application. Run `node scripts/validate.mjs` and `node --test tests/*.test.mjs` before publishing. The v1.2.0 assurance record is in [`docs/QA-1.2.0.md`](docs/QA-1.2.0.md), and device-level acceptance steps are in [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md).
