# Still Pine practice-pack format

The app treats the curriculum as data rather than hard-coded screens. A practice release is a single JSON file with the extension:

`<name>.zenpack.json`

The current schema version is `still-pine.zenpack/v1`.

## Two ways to install a future pack

### 1. Immediate local install

Open **Packs → Import practice pack** and choose the `.zenpack.json` file. The pack becomes available immediately in that browser and is stored in `localStorage`.

This is the quickest way to use a practice package issued during a conversation.

### 2. Permanent repository install

1. Copy the pack to `content/packs/`.
2. Add its relative path to the `packs` array in `content/manifest.json`.
3. Commit and push.
4. GitHub Pages publishes the new version. On next load the app retrieves the repository pack.

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

## Design rule for future packs

A phase may contain rich teaching in its package definition, but the active-session screen should show only one concise instruction at a time. Do not turn zazen into a scrolling lesson.

## Supported phase fields

- `id`: stable machine-readable identifier
- `kind`: small context label
- `title`: phase name
- `durationSec`: integer number of seconds
- `instruction`: the primary visible instruction
- `secondary`: optional quiet secondary instruction
- `cues`: timed text prompts `{ "atSec": 120, "text": "..." }`
- `substeps`: sequential sub-phases with individual durations, useful for kuji or other formal sequences

See `templates/blank.zenpack.json` and `schemas/zenpack.schema.json`.
