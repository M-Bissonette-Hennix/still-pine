# Publish Still Pine on GitHub Pages

This project is intentionally plain static HTML/CSS/JavaScript. It needs no npm install, build step, database, or server.

## Recommended repository

Create a dedicated public repository such as:

`still-pine-zazen`

Any repository name works. A project-site URL will normally be:

`https://YOUR-USERNAME.github.io/still-pine-zazen/`

All paths in the application are relative, so project-site hosting is supported.

## Publish from the main branch

1. Create the repository on GitHub.
2. Upload or push the **contents** of this package to the repository root. `index.html` must be at the root.
3. Commit to `main`.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select branch **main** and folder **/(root)**, then save.
7. GitHub will publish the site and display the URL in the Pages settings.

Because the site has no build process, branch deployment is the simplest option.

## iPhone / iPad installation

After the Pages site is live:

1. Open the site in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch **Still Pine** from its Home Screen icon.

The service worker caches the core app and Foundation I content after the site has loaded successfully, allowing the installed PWA to continue opening when connectivity is poor.

## Updating a weekly practice

Copy the new `.zenpack.json` file into `content/packs/`, add it to `content/manifest.json`, commit, and push. No JavaScript changes are necessary unless the pack format itself changes.

## Privacy

There is no backend. Practice notes, settings, and locally imported packs remain in that browser's local storage. Repository-installed packs and reading notes are public if the GitHub repository is public.
