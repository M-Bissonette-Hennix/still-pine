import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildTimeline,
  locateTimeline,
  createClock,
  clockElapsedSec,
  pauseClock,
  resumeClock,
  seekClockToStage,
  practicePosition
} from '../js/practice-engine.js';

const pack = JSON.parse(await readFile(new URL('../content/packs/foundation-01.zenpack.json', import.meta.url), 'utf8'));
const stages = pack.session.stages;

test('Foundation I timeline remains exactly 25m30s', () => {
  const timeline = buildTimeline(stages);
  assert.equal(timeline.totalSec, 1530);
  assert.deepEqual(timeline.segments.map(item => item.durationSec), [180, 90, 300, 900, 60]);
});

test('timeline boundaries select the exact expected stage', () => {
  const timeline = buildTimeline(stages);
  assert.equal(locateTimeline(timeline, 0).stageIndex, 0);
  assert.equal(locateTimeline(timeline, 179.999).stageIndex, 0);
  assert.equal(locateTimeline(timeline, 180).stageIndex, 1);
  assert.equal(locateTimeline(timeline, 270).stageIndex, 2);
  assert.equal(locateTimeline(timeline, 570).stageIndex, 3);
  assert.equal(locateTimeline(timeline, 1470).stageIndex, 4);
  assert.equal(locateTimeline(timeline, 1530).complete, true);
});

test('absolute clock carries suspension time across multiple stages', () => {
  const clock = createClock(stages, 1_000_000);
  const position = practicePosition(clock, 1_000_000 + 600_000);
  assert.equal(position.stageIndex, 3);
  assert.equal(position.stageElapsedSec, 30);
});

test('pause excludes paused wall-clock time and resume remains exact', () => {
  const clock = createClock(stages, 10_000);
  assert.equal(clockElapsedSec(clock, 20_000), 10);
  pauseClock(clock, 20_000);
  assert.equal(clockElapsedSec(clock, 120_000), 10);
  resumeClock(clock, 120_000);
  assert.equal(clockElapsedSec(clock, 125_000), 15);
});

test('manual phase navigation seeks to exact stage boundary', () => {
  const clock = createClock(stages, 0);
  assert.equal(seekClockToStage(clock, 3, 5000), true);
  const position = practicePosition(clock, 5000);
  assert.equal(position.stageIndex, 3);
  assert.equal(position.stageElapsedSec, 0);
});
