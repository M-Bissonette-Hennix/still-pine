# Still Pine — Sōtō Practice Companion

A small installable web app for guided daily zazen, modular practice curricula, post-sit inquiry, and Zen reading.

**Still Pine is an independent personal practice tool. It is not an official product of Sōtō Zen Buddhism or any temple, teacher, or lineage.**

## What is included

- Foundation I daily practice: kuji threshold → entering zazen → susokukan → shikantaza → closing form
- Full-screen guided timer with automatic phase transitions
- Nine timed kuji substeps
- Quiet generated transition bell, optional vibration, and screen wake lock where supported
- No streaks, scores, badges, performance graphs, or attention metrics
- One-sentence local sitting notes
- Post-zazen Dharma inquiry
- Reading room with official-source links and local study notes
- Local `.txt` / `.md` reader for personal texts
- Installable `.zenpack.json` curriculum packages
- Repository manifest for permanently shipping future practice packs
- PWA/offline cache after first successful load
- No dependencies, accounts, trackers, analytics, server, or build step

## Run locally

Browsers block some `fetch()` calls when an HTML file is opened directly from disk. Serve the folder instead:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

See [`docs/GITHUB-PAGES.md`](docs/GITHUB-PAGES.md).

## Future curriculum releases

See [`docs/PACK-AUTHORING.md`](docs/PACK-AUTHORING.md).

The intended workflow is simple: a teaching/update can be accompanied by one new `.zenpack.json` file. Import it immediately in the app, or place it in `content/packs/` and add one line to `content/manifest.json` for permanent deployment.

## Reading texts

The repository does not copy modern copyrighted Zen translations merely for convenience. Where appropriate it links to authoritative external sources and can ship original study notes. Your own legally obtained `.txt` or `.md` files can be opened locally in the Reading Room without uploading them anywhere.

## Safety / physical practice

Do not use posture as an endurance test. Sharp pain, persistent numbness, or circulation problems are reasons to adjust the posture carefully. Seiza support, a zafu, or another stable sitting form can be used.
