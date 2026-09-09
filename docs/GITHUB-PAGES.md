# Publish Still Pine on GitHub Pages

Still Pine is intentionally plain static HTML/CSS/JavaScript. Runtime use requires no npm install, build step, database, account, or server.

The canonical deployment is a GitHub project site using relative paths, so repository-subpath hosting remains supported.

## Publish from `main`

1. Put the release contents at the repository root. `index.html` must be at the root.
2. Run the release validator locally if Node is available: `node scripts/validate.mjs`.
3. Commit to the stable branch only after validation passes.
4. In **Settings → Pages**, use **Deploy from a branch**.
5. Select **main** and **/(root)**.

The included `.nojekyll` file makes the static deployment intent explicit.

## iPhone / iPad installation

1. Open the Pages site in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch Still Pine from its Home Screen icon.

## Offline and update behavior

v1.2.0 uses request-aware service-worker caching:

- the app shell and bundled practice visuals are precached;
- local curriculum/readings use network-first behavior with a last-known-good cache fallback;
- HTML fallback is used only for page navigation, never as a fake response to a missing image/JSON asset;
- a newly downloaded service worker waits rather than taking over immediately;
- when an update is ready, the running app offers **Apply update**;
- if Practice Mode is active, update activation is deferred until the sitting has ended.

When testing a release, verify both a fresh load and an already-installed Home Screen PWA. A GitHub Pages source update is not considered complete until the installed app can obtain and activate the new service worker.

## Updating a practice pack

Copy the new `.zenpack.json` file into `content/packs/`, add it to `content/manifest.json`, validate, commit, and push. JavaScript changes are not required unless the pack format or engine capability changes.

## Privacy and local recovery

There is no backend. Practice notes, settings, and imported packs remain in browser-local storage. v1.2.0 adds explicit local backup/restore and a persistent-storage request where the browser supports it.
