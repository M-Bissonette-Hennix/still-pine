const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const MAX_STAGES = 100;
const MAX_STAGE_SEC = 12 * 60 * 60;
const MAX_SUBSTEPS = 200;
const MAX_CUES = 200;

export function isSafeLocalPath(value) {
  if (typeof value !== 'string' || !value.length || value.length > 512 || value.trim() !== value) return false;
  if (value.includes('?') || value.includes('#') || value.includes('\0')) return false;
  let decoded;
  try { decoded = decodeURIComponent(value); }
  catch { return false; }
  if (decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return false;
  const clean = decoded.startsWith('./') ? decoded.slice(2) : decoded;
  if (!clean || clean.split('/').some(part => part === '..' || part === '.')) return false;
  return true;
}

function text(value, max = 5000) {
  return typeof value === 'string' && value.length <= max;
}

function positiveInt(value, max = MAX_STAGE_SEC) {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

export function validatePackDetailed(pack) {
  const errors = [];
  const fail = message => errors.push(message);

  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return { valid: false, errors: ['Pack must be a JSON object.'] };
  }
  if (pack.format !== 'still-pine.zenpack/v1') fail('format must be still-pine.zenpack/v1.');
  if (typeof pack.id !== 'string' || !ID_RE.test(pack.id)) fail('id must use lowercase letters, numbers, and hyphens.');
  if (!text(pack.version, 64) || !pack.version.trim()) fail('version must be a non-empty string.');
  if (!text(pack.title, 200) || !pack.title.trim()) fail('title must be a non-empty string.');
  for (const [key, max] of [['shortTitle', 200], ['tradition', 500], ['description', 5000], ['weeklyTeaching', 5000], ['weeklyTeachingNote', 5000]]) {
    if (pack[key] != null && !text(pack[key], max)) fail(`${key} must be text.`);
  }
  if (!pack.session || typeof pack.session !== 'object' || Array.isArray(pack.session)) fail('session is required.');
  else if (!text(pack.session.title, 200) || !pack.session.title.trim()) fail('session.title must be a non-empty string.');

  const stages = pack.session?.stages;
  if (!Array.isArray(stages) || stages.length < 1 || stages.length > MAX_STAGES) {
    fail(`session.stages must contain 1–${MAX_STAGES} stages.`);
  } else {
    const stageIds = new Set();
    stages.forEach((stage, i) => {
      const where = `stage ${i + 1}`;
      if (!stage || typeof stage !== 'object') { fail(`${where} must be an object.`); return; }
      if (typeof stage.id !== 'string' || !ID_RE.test(stage.id)) fail(`${where} has an invalid id.`);
      else if (stageIds.has(stage.id)) fail(`${where} repeats stage id “${stage.id}”.`);
      else stageIds.add(stage.id);
      if (!text(stage.title, 200) || !stage.title.trim()) fail(`${where} requires a title.`);
      if (!positiveInt(stage.durationSec)) fail(`${where} durationSec must be an integer from 1 to ${MAX_STAGE_SEC}.`);
      if (!text(stage.instruction, 5000) || !stage.instruction.trim()) fail(`${where} instruction must be non-empty text.`);
      if (stage.kind != null && !text(stage.kind, 500)) fail(`${where} kind must be text.`);
      if (stage.secondary != null && !text(stage.secondary, 5000)) fail(`${where} secondary must be text.`);
      validateVisual(stage, where, fail);

      if (stage.cues != null) {
        if (!Array.isArray(stage.cues) || stage.cues.length > MAX_CUES) fail(`${where} cues must be an array of at most ${MAX_CUES} items.`);
        else {
          let lastAt = -1;
          stage.cues.forEach((cue, j) => {
            const cueWhere = `${where} cue ${j + 1}`;
            if (!cue || typeof cue !== 'object') { fail(`${cueWhere} must be an object.`); return; }
            if (!Number.isInteger(cue.atSec) || cue.atSec < 0 || cue.atSec >= stage.durationSec) fail(`${cueWhere} atSec must fall inside the stage.`);
            if (Number.isInteger(cue.atSec) && cue.atSec < lastAt) fail(`${where} cues must be ordered by atSec.`);
            if (Number.isInteger(cue.atSec)) lastAt = cue.atSec;
            if (!text(cue.text, 1000) || !cue.text.trim()) fail(`${cueWhere} requires text.`);
          });
        }
      }

      if (stage.substeps != null) {
        if (!Array.isArray(stage.substeps) || stage.substeps.length < 1 || stage.substeps.length > MAX_SUBSTEPS) {
          fail(`${where} substeps must contain 1–${MAX_SUBSTEPS} items.`);
        } else {
          let sum = 0;
          stage.substeps.forEach((sub, j) => {
            const subWhere = `${where} substep ${j + 1}`;
            if (!sub || typeof sub !== 'object') { fail(`${subWhere} must be an object.`); return; }
            if (!text(sub.title, 200) || !sub.title.trim()) fail(`${subWhere} requires a title.`);
            if (!positiveInt(sub.durationSec, stage.durationSec || MAX_STAGE_SEC)) fail(`${subWhere} has an invalid durationSec.`);
            else sum += sub.durationSec;
            if (sub.cue != null && !text(sub.cue, 500)) fail(`${subWhere} cue must be text.`);
            validateVisual(sub, subWhere, fail);
          });
          if (positiveInt(stage.durationSec) && sum !== stage.durationSec) {
            fail(`${where} substep durations total ${sum}s but the stage is ${stage.durationSec}s.`);
          }
        }
      }
    });
  }


  if (pack.afterPractice != null) {
    if (!pack.afterPractice || typeof pack.afterPractice !== 'object' || Array.isArray(pack.afterPractice)) fail('afterPractice must be an object.');
    else {
      if (pack.afterPractice.logPrompt != null && !text(pack.afterPractice.logPrompt, 1000)) fail('afterPractice.logPrompt must be text.');
      if (pack.afterPractice.inquiries != null) {
        if (!Array.isArray(pack.afterPractice.inquiries) || pack.afterPractice.inquiries.length > 100) fail('afterPractice.inquiries must be an array of at most 100 items.');
        else pack.afterPractice.inquiries.forEach((value, index) => { if (!text(value, 5000)) fail(`afterPractice inquiry ${index + 1} must be text.`); });
      }
    }
  }

  if (pack.study != null) {
    if (!pack.study || typeof pack.study !== 'object' || Array.isArray(pack.study)) fail('study must be an object.');
    else {
      if (pack.study.assignedReadingIds != null) {
        if (!Array.isArray(pack.study.assignedReadingIds) || pack.study.assignedReadingIds.length > 200) fail('study.assignedReadingIds must be an array of at most 200 items.');
        else pack.study.assignedReadingIds.forEach((value, index) => { if (typeof value !== 'string' || !ID_RE.test(value)) fail(`study reading id ${index + 1} is invalid.`); });
      }
      if (pack.study.contemplation != null && !text(pack.study.contemplation, 5000)) fail('study.contemplation must be text.');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateVisual(item, where, fail) {
  if (item.imagePath != null) {
    if (!isSafeLocalPath(item.imagePath)) fail(`${where} imagePath must be a safe same-origin relative path.`);
    if (!text(item.imageAlt, 500) || !item.imageAlt.trim()) fail(`${where} with imagePath requires non-empty imageAlt.`);
  } else if (item.imageAlt != null && !text(item.imageAlt, 500)) {
    fail(`${where} imageAlt must be text.`);
  }
}

export function validatePack(pack) {
  return validatePackDetailed(pack).valid;
}
