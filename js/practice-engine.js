export function buildTimeline(stages) {
  if (!Array.isArray(stages) || !stages.length) throw new Error('A practice timeline requires at least one stage.');
  let cursor = 0;
  const segments = stages.map((stage, index) => {
    const durationSec = Number(stage.durationSec);
    if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error(`Invalid duration for stage ${index + 1}.`);
    const startSec = cursor;
    const endSec = cursor + durationSec;
    cursor = endSec;
    return { index, startSec, endSec, durationSec };
  });
  return { segments, totalSec: cursor };
}

export function locateTimeline(timeline, elapsedSec) {
  const elapsed = Math.max(0, Number(elapsedSec) || 0);
  if (elapsed >= timeline.totalSec) {
    const last = timeline.segments.at(-1);
    return {
      complete: true,
      stageIndex: last.index,
      stageElapsedSec: last.durationSec,
      sessionElapsedSec: timeline.totalSec,
      remainingSec: 0
    };
  }
  const segment = timeline.segments.find(item => elapsed < item.endSec) || timeline.segments.at(-1);
  return {
    complete: false,
    stageIndex: segment.index,
    stageElapsedSec: Math.max(0, elapsed - segment.startSec),
    sessionElapsedSec: elapsed,
    remainingSec: Math.max(0, segment.endSec - elapsed)
  };
}

export function createClock(stages, nowMs = Date.now()) {
  return {
    timeline: buildTimeline(stages),
    baseElapsedSec: 0,
    anchorMs: nowMs,
    paused: false
  };
}

export function clockElapsedSec(clock, nowMs = Date.now()) {
  const movingSec = clock.paused ? 0 : Math.max(0, nowMs - clock.anchorMs) / 1000;
  return Math.min(clock.timeline.totalSec, Math.max(0, clock.baseElapsedSec + movingSec));
}

export function pauseClock(clock, nowMs = Date.now()) {
  if (clock.paused) return clock;
  clock.baseElapsedSec = clockElapsedSec(clock, nowMs);
  clock.anchorMs = nowMs;
  clock.paused = true;
  return clock;
}

export function resumeClock(clock, nowMs = Date.now()) {
  if (!clock.paused) return clock;
  clock.anchorMs = nowMs;
  clock.paused = false;
  return clock;
}

export function seekClockToStage(clock, stageIndex, nowMs = Date.now()) {
  const segment = clock.timeline.segments[stageIndex];
  if (!segment) return false;
  clock.baseElapsedSec = segment.startSec;
  clock.anchorMs = nowMs;
  return true;
}

export function practicePosition(clock, nowMs = Date.now()) {
  return locateTimeline(clock.timeline, clockElapsedSec(clock, nowMs));
}
