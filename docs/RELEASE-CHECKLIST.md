# Still Pine release checklist

This checklist supplements `node scripts/validate.mjs`. A release is not considered complete merely because GitHub Pages serves new source to a fresh browser.

## Automated gate

- `node --check app.js`
- `node --check sw.js`
- `node --check js/practice-engine.js`
- `node --check js/pack-validator.js`
- `node scripts/validate.mjs`
- `node --test tests/*.test.mjs`

## Fresh-load QA

- Load the Pages site in a fresh browser context.
- Verify Today, Practice, Library, Packs, and Settings render without console errors.
- Verify Foundation I reports 25m30s and five phases.
- Begin practice and confirm all nine kuji visuals progress in order.
- Verify transition bell behavior after user initiation.
- Verify pause/resume and Previous/Next.
- Verify automatic phase progression.
- Verify completion returns to Today and offers the post-zazen record.
- Save and reload a one-sentence observation.
- Open the local reading notes.
- Import a valid pack and reject a malformed/unsafe pack.

## Suspension/timer QA

- Start a session, background/lock the device long enough to cross at least one stage boundary, then return.
- Confirm the displayed phase and remaining time reflect absolute elapsed time rather than resuming from the old stage.
- Pause a session, background the device, return, and confirm paused time did not advance.

## Offline QA

- Complete one successful online load.
- Disconnect networking.
- Reload the installed PWA.
- Confirm app shell, Foundation I, kuji images, local reading notes, timer, and generated bells remain available.
- Confirm an unavailable external reading fails normally rather than receiving the app HTML as a fake response.

## Installed-PWA update QA

- Begin from the previous released service worker.
- Publish the new release/cache identity.
- Launch the already-installed Home Screen PWA online.
- Confirm the new worker installs into waiting state and Still Pine surfaces an update-ready action.
- If Practice Mode is active, confirm the update is held without interrupting the sitting.
- End practice, apply the update, and confirm the PWA reloads under the new service worker.
- Re-test offline launch.

## Data durability QA

- Export a backup.
- Inspect that it includes settings/imported packs/records and no unrelated browser data.
- Restore the backup and verify state returns.
- Confirm malformed backup files are rejected.
- Request persistent storage where the browser supports it.
- Copy diagnostics and confirm sitting-note text is absent.

## Accessibility/mobile QA

- iPhone portrait: no clipped controls; safe-area padding is respected.
- Practice controls remain reachable without precision tapping.
- Settings traps focus and Escape closes it on keyboard-capable platforms.
- File controls are keyboard operable.
- Focus indicators are visible.
- Screen-reader announcements occur on meaningful phase/cue changes rather than every timer tick.
- `prefers-reduced-motion` suppresses nonessential motion.
- Unsupported vibration controls are not presented as functional.
