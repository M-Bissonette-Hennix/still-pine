# Still Pine v1.2.0 — Release Assurance Record

Release: **1.2.0 — Foundation Hardening**  
Baseline: `M-Bissonette-Hennix/still-pine@26187ec7a15d29ec17ef107c84517b4811df5620`  
Release date: 2026-09-08

## Scope boundary

This release changes application engineering, durability, PWA behavior, validation, accessibility, and QA infrastructure. It does **not** change the prescribed Foundation I spiritual curriculum. The bundled Foundation I pack remains byte-identical to the v1.1.0 baseline, as do all nine user-supplied kuji reference images. The release validator enforces their SHA-256 provenance.

## Automated source gate

Executed successfully:

```text
node --check app.js
node --check sw.js
node --check js/practice-engine.js
node --check js/pack-validator.js
node --check scripts/validate.mjs
node scripts/validate.mjs
node --test tests/*.test.mjs
```

Result: **PASS**.

The test suite contains 16 tests covering pack validation, the absolute practice clock, suspension across multiple stages, pause/resume, manual phase seeking, service-worker install/activation behavior, the one-time v1.1 migration, deferred managed updates, cache cleanup, offline navigation fallback, and non-document offline failures.

## Curriculum-integrity gate

The validator verifies:

- Foundation I total duration remains exactly 1,530 seconds (25m30s);
- stage order and durations remain `180 / 90 / 300 / 900 / 60`;
- the kuji threshold remains nine 20-second substeps totaling 180 seconds;
- the Foundation I JSON SHA-256 remains the known v1.1.0 value;
- each of the nine kuji image SHA-256 values remains the known v1.1.0 value.

Any unintended change to those protected artifacts fails the release gate.

## Application contract assurance

The release gate statically cross-checks the real application DOM contract against `app.js`, including required element IDs, labels, `aria-labelledby` references, local asset paths, runtime module paths, and service-worker core assets. The unit suite separately executes the timer, pack-validation, and service-worker state machines.

The application layer additionally includes defensive runtime handling for repository-pack isolation, malformed local imports, local backup replacement with rollback-on-write-failure, capability-aware vibration, focus isolation for modal Practice/Settings states, and privacy-safe diagnostics.

Result: **PASS**.

## Responsive visual QA

Practice Mode, Today, and Settings were rendered and inspected at:

- iPhone-class 390 × 844;
- compact iPhone-class 375 × 667;
- desktop 1440 × 900.

The densest Foundation I state—the kuji stage with visual reference, primary/secondary instruction, timer, and controls—fits within each tested viewport without control overlap. Safe-area and reduced-height rules were specifically audited.
Practice Mode and Settings also isolate keyboard focus from the underlying page; completion records distinguish scheduled duration from actual elapsed practice time when manual phase navigation is used.

Result: **PASS**.

## Service-worker assurance

A mocked service-worker lifecycle/fetch harness verifies:

- core assets are precached before activation;
- ordinary v1.2+ installs do not call `skipWaiting()` automatically;
- a legacy `still-pine-v1.1.0` cache triggers the one-time automatic handoff into the managed-update architecture;
- explicit `SKIP_WAITING` remains the normal v1.2+ activation mechanism;
- old Still Pine caches are removed while unrelated caches are untouched;
- failed image requests do not receive `index.html` as a false fallback;
- failed navigation requests can receive the cached application shell.

Result: **PASS**.

## Environment limitation

The available execution environment blocks Chromium network navigation—including loopback and synthetic origins—by administrator policy. Therefore a true browser-controlled GitHub Pages/offline service-worker E2E session could not be executed here. This limitation is not disguised as a passing test. It was compensated for with:

1. responsive Chromium captures of representative application states;
2. executable timer/pack/service-worker state-machine tests;
3. static DOM/asset/runtime-contract validation;
4. the installed-PWA manual checks in `docs/RELEASE-CHECKLIST.md`.

The final device-level acceptance step remains the already-installed iPhone PWA after deployment, particularly the v1.1→v1.2 service-worker handoff and offline relaunch.

## Release decision

The source is suitable for packaging as v1.2.0. Repository deployment should occur only from the validated package, followed by the installed-iPhone acceptance checks in the release checklist.
