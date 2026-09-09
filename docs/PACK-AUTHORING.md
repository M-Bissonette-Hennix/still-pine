# Still Pine practice-pack format

Still Pine treats curriculum as data rather than hard-coded screens. A practice release is a JSON file named:

`<name>.zenpack.json`

The current format is `still-pine.zenpack/v1`.

The spirituality/curriculum workflow is authoritative for contemplative content. This document describes only how the software represents that content.

## Two ways to install a future pack

### 1. Immediate local install

Open **Packs → Import practice pack** and choose the `.zenpack.json` file. Still Pine validates the file before installation. Imported packs remain local to that browser/device.

### 2. Permanent repository install

1. Copy the pack to `content/packs/`.
2. Add its relative path to `content/manifest.json`.
3. Run `node scripts/validate.mjs`.
4. Commit and push.
5. GitHub Pages publishes the repository version.

Example:

```json
{
  "format": "still-pine.manifest/v1",
  "packs": [
    "./content/packs/foundation-01.zenpack.json",
    "./content/packs/foundation-02.zenpack.json"
  ]
}
```

## Runtime invariants

Still Pine v1.2.0 rejects packs that violate core execution invariants. In particular:

- stage IDs must be unique and machine-safe;
- durations must be positive integers;
- cues must be ordered and fall inside their stage;
- when a stage uses substeps, their durations must sum exactly to the parent stage duration;
- image references must be same-origin relative paths and may not escape the application directory;
- every `imagePath` must have non-empty `imageAlt`;
- oversized or structurally unreasonable packs are rejected.

These checks protect timer truth, offline behavior, accessibility, and local privacy. They do not judge the spiritual content of a pack.

## Supported stage fields

- `id`: stable machine-readable identifier
- `kind`: small context label
- `title`: phase name
- `durationSec`: integer seconds
- `instruction`: primary visible instruction
- `secondary`: optional quiet secondary instruction
- `cues`: timed text prompts, e.g. `{ "atSec": 120, "text": "..." }`
- `imagePath`: optional same-origin relative practice visual
- `imageAlt`: required alt text whenever an image is used
- `substeps`: sequential timed sub-phases

A visual substep can be written as:

```json
{
  "title": "Rin · 臨",
  "cue": "Dokko-in",
  "durationSec": 20,
  "imagePath": "./assets/kuji/01-rin.jpg",
  "imageAlt": "Hand seal diagram for Rin · 臨"
}
```

## Design rule

A phase may contain rich curriculum context in its package definition, but Practice Mode should display only the instruction required for the current moment. Still Pine should carry procedural burden, not turn zazen into a scrolling lesson.

See `templates/blank.zenpack.json`, `schemas/zenpack.schema.json`, and `js/pack-validator.js`.
