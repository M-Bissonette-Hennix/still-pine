import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePackDetailed, isSafeLocalPath } from '../js/pack-validator.js';

const foundation = JSON.parse(await readFile(new URL('../content/packs/foundation-01.zenpack.json', import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

test('bundled Foundation I passes strict runtime validation', () => {
  const result = validatePackDetailed(foundation);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('unsafe asset URLs and traversal are rejected', () => {
  for (const value of ['https://tracker.example/x.jpg', '//tracker.example/x.jpg', '../outside.jpg', '/root.jpg', 'data:image/png;base64,AAAA', './%2e%2e/outside.jpg', './assets/%2E%2E/outside.jpg', './assets%2f..%2foutside.jpg']) {
    assert.equal(isSafeLocalPath(value), false, value);
  }
  assert.equal(isSafeLocalPath('./assets/kuji/01-rin.jpg'), true);
});

test('substeps must exactly fill their parent stage', () => {
  const pack = clone(foundation);
  pack.session.stages[0].substeps[0].durationSec = 19;
  const result = validatePackDetailed(pack);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /substep durations total/i);
});

test('duplicate stage IDs are rejected', () => {
  const pack = clone(foundation);
  pack.session.stages[1].id = pack.session.stages[0].id;
  const result = validatePackDetailed(pack);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /repeats stage id/i);
});

test('cues outside their stage are rejected', () => {
  const pack = clone(foundation);
  pack.session.stages[1].cues[0].atSec = 90;
  const result = validatePackDetailed(pack);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /must fall inside the stage/i);
});
