import {
  createClock,
  pauseClock,
  resumeClock,
  seekClockToStage,
  practicePosition
} from './js/practice-engine.js';
import { isSafeLocalPath, validatePack, validatePackDetailed } from './js/pack-validator.js';

const APP_VERSION = '1.2.0';
const BACKUP_FORMAT = 'still-pine.backup/v1';
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const STORAGE = {
  settings: 'stillPine.settings.v1',
  importedPacks: 'stillPine.importedPacks.v1',
  activePack: 'stillPine.activePack.v1',
  logs: 'stillPine.logs.v1'
};

const defaultSettings = { bell: true, vibrate: true, wake: true, readerSize: 20 };
const state = {
  settings: sanitizeSettings(readJson(STORAGE.settings, {})),
  repoPacks: [],
  importedPacks: [],
  activePack: null,
  library: [],
  wakeLock: null,
  practice: null,
  audioContext: null,
  settingsOpener: null,
  swRegistration: null,
  pendingUpdate: null,
  reloadingForUpdate: false,
  repoPackErrors: [],
  practiceOpener: null
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Could not write ${key}.`, err);
    return false;
  }
}

function secondsLabel(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}

function clockLabel(sec) {
  const n = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function totalDuration(pack) {
  return pack?.session?.stages?.reduce((n, stage) => n + Number(stage.durationSec || 0), 0) || 0;
}

function allPacks() {
  const map = new Map();
  [...state.repoPacks, ...state.importedPacks].forEach(pack => map.set(pack.id, pack));
  return [...map.values()];
}

async function init() {
  hydrateImportedPacks();
  bindNavigation();
  bindSettings();
  bindStaticActions();
  applyCapabilities();
  applySettings();
  await Promise.all([loadPacks(), loadLibrary()]);
  chooseActivePack();
  renderAll();
  await refreshStorageStatus();
  registerServiceWorker();
}

function hydrateImportedPacks() {
  const stored = readJson(STORAGE.importedPacks, []);
  if (!Array.isArray(stored)) return;
  state.importedPacks = stored.filter(pack => validatePack(pack));
  if (state.importedPacks.length !== stored.length) writeJson(STORAGE.importedPacks, state.importedPacks);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return response.json();
}

async function loadPacks() {
  state.repoPackErrors = [];
  try {
    const manifest = await fetchJson('./content/manifest.json');
    if (manifest?.format !== 'still-pine.manifest/v1' || !Array.isArray(manifest.packs)) throw new Error('Invalid repository pack manifest.');
    const paths = manifest.packs.filter(path => {
      const safe = isSafeLocalPath(path);
      if (!safe) state.repoPackErrors.push(`Rejected unsafe pack path: ${String(path)}`);
      return safe;
    });
    const results = await Promise.allSettled(paths.map(async path => {
      const pack = await fetchJson(path);
      const validation = validatePackDetailed(pack);
      if (!validation.valid) throw new Error(`${path}: ${validation.errors.join(' ')}`);
      return pack;
    }));
    state.repoPacks = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') state.repoPacks.push(result.value);
      else state.repoPackErrors.push(result.reason?.message || `Could not load ${paths[index]}.`);
    });
    state.repoPackErrors.forEach(message => console.warn(message));
  } catch (err) {
    state.repoPacks = [];
    state.repoPackErrors.push(err.message || 'Could not load repository packs.');
    console.warn('Could not load repository packs.', err);
  }
}

async function loadLibrary() {
  try {
    const data = await fetchJson('./content/readings/library.json');
    state.library = Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    state.library = [];
    console.warn('Could not load reading library.', err);
  }
}

function chooseActivePack() {
  const packs = allPacks();
  const preferred = localStorage.getItem(STORAGE.activePack);
  state.activePack = packs.find(pack => pack.id === preferred) || packs[0] || null;
  if (state.activePack) localStorage.setItem(STORAGE.activePack, state.activePack.id);
}

function bindNavigation() {
  $$('.tab').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
}

function showView(name) {
  $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  $('#app').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function bindSettings() {
  $('#settingsButton').addEventListener('click', openSettings);
  $('#closeSettings').addEventListener('click', closeSettings);
  $('#scrim').addEventListener('click', closeSettings);
  $('#settingsPanel').addEventListener('keydown', trapSettingsFocus);
  $('#practiceOverlay').addEventListener('keydown', trapPracticeFocus);
  $('#settingBell').addEventListener('change', saveSettings);
  $('#settingVibrate').addEventListener('change', saveSettings);
  $('#settingWake').addEventListener('change', saveSettings);
  $('#settingFontSize').addEventListener('input', saveSettings);
}

function bindStaticActions() {
  $('#startFromToday').addEventListener('click', beginPractice);
  $('#startPractice').addEventListener('click', beginPractice);
  $('#exitPractice').addEventListener('click', () => endPractice(false));
  $('#pausePractice').addEventListener('click', togglePause);
  $('#nextPhase').addEventListener('click', () => advanceStage(1));
  $('#previousPhase').addEventListener('click', () => advanceStage(-1));
  $('#quickLogForm').addEventListener('submit', saveQuickLog);
  $('#packInput').addEventListener('change', importPack);
  $('#personalTextInput').addEventListener('change', openPersonalText);
  $('#backupInput').addEventListener('change', importBackup);
  $('#exportBackup').addEventListener('click', exportBackup);
  $('#persistStorage').addEventListener('click', requestPersistentStorage);
  $('#copyDiagnostics').addEventListener('click', copyDiagnostics);
  $('#applyUpdate').addEventListener('click', applyPendingUpdate);
  $('#closeReader').addEventListener('click', () => $('#reader').classList.add('hidden'));
  $$('.file-button[tabindex]').forEach(label => label.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    $('input[type=\"file\"]', label)?.click();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#settingsPanel').classList.contains('hidden')) closeSettings();
  });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (state.practice) {
      if (state.settings.wake) await requestWakeLock();
      syncPractice(true);
    }
    state.swRegistration?.update().catch(() => {});
  });
}

function openSettings() {
  if (state.practice) return;
  state.settingsOpener = document.activeElement;
  $('#settingsPanel').classList.remove('hidden');
  $('#settingsButton').setAttribute('aria-expanded', 'true');
  $('#scrim').classList.remove('hidden');
  setBackgroundInert(true);
  $('#closeSettings').focus();
  refreshStorageStatus();
  renderUpdateState();
}

function closeSettings() {
  $('#settingsPanel').classList.add('hidden');
  $('#settingsButton').setAttribute('aria-expanded', 'false');
  $('#scrim').classList.add('hidden');
  setBackgroundInert(false);
  state.settingsOpener?.focus?.();
  state.settingsOpener = null;
  renderUpdateState();
}

function setBackgroundInert(value) {
  ['.site-header', '.tabs', '#app'].forEach(selector => {
    const element = $(selector);
    if (element && 'inert' in element) element.inert = value;
  });
}

function trapSettingsFocus(event) {
  trapFocusWithin(event, $('#settingsPanel'));
}

function trapPracticeFocus(event) {
  trapFocusWithin(event, $('#practiceOverlay'));
}

function trapFocusWithin(event, root) {
  if (event.key !== 'Tab' || !root) return;
  const focusable = $$('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', root).filter(el => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function applyCapabilities() {
  const vibrationSupported = typeof navigator.vibrate === 'function';
  $('#vibrateSettingRow').classList.toggle('hidden', !vibrationSupported);
  $('#settingVibrate').disabled = !vibrationSupported;
  $('#appVersion').textContent = `Still Pine v${APP_VERSION}`;
}

function applySettings() {
  $('#settingBell').checked = Boolean(state.settings.bell);
  $('#settingVibrate').checked = Boolean(state.settings.vibrate);
  $('#settingWake').checked = Boolean(state.settings.wake);
  $('#settingFontSize').value = Number(state.settings.readerSize) || defaultSettings.readerSize;
  document.documentElement.style.setProperty('--reader-size', `${Number(state.settings.readerSize) || defaultSettings.readerSize}px`);
}

function saveSettings() {
  state.settings = {
    bell: $('#settingBell').checked,
    vibrate: $('#settingVibrate').checked && typeof navigator.vibrate === 'function',
    wake: $('#settingWake').checked,
    readerSize: Math.min(26, Math.max(17, Number($('#settingFontSize').value) || 20))
  };
  writeJson(STORAGE.settings, state.settings);
  applySettings();
}

function renderAll() {
  renderToday();
  renderPracticePreview();
  renderPacks();
  renderLibrary();
}

function renderToday() {
  const pack = state.activePack;
  if (!pack) {
    $('#today-title').textContent = 'No active practice';
    $('#today-description').textContent = 'No valid practice pack is installed.';
    $('#startFromToday').disabled = true;
    $('#sessionLength').textContent = '';
    renderLastLog();
    return;
  }
  $('#startFromToday').disabled = false;
  $('#today-title').textContent = pack.title;
  $('#today-description').textContent = pack.description || '';
  $('#weeklyTeaching').textContent = pack.weeklyTeaching || '';
  $('#weeklyTeachingNote').textContent = pack.weeklyTeachingNote || '';
  $('#sessionLength').textContent = `${secondsLabel(totalDuration(pack))} · ${pack.session.stages.length} phases`;
  $('#inquiryList').innerHTML = '';
  (pack.afterPractice?.inquiries || []).forEach(question => {
    const element = document.createElement('p');
    element.className = 'inquiry-question';
    element.textContent = question;
    $('#inquiryList').appendChild(element);
  });
  if (pack.study?.contemplation) {
    const contemplation = document.createElement('p');
    contemplation.className = 'muted';
    contemplation.textContent = pack.study.contemplation;
    $('#inquiryList').appendChild(contemplation);
  }
  const reading = (pack.study?.assignedReadingIds || []).map(id => state.library.find(item => item.id === id)).find(Boolean);
  $('#todayReading').innerHTML = '';
  if (reading) $('#todayReading').appendChild(makeReadingCompact(reading));
  renderLastLog();
}

function makeReadingCompact(item) {
  const wrap = document.createElement('div');
  const heading = document.createElement('h3'); heading.textContent = item.title;
  const description = document.createElement('p'); description.className = 'muted'; description.textContent = item.description;
  const button = document.createElement('button'); button.className = 'secondary'; button.textContent = item.localPath ? 'Read in app' : 'Open official text';
  button.addEventListener('click', () => openReading(item));
  wrap.append(heading, description, button);
  return wrap;
}

function renderPracticePreview() {
  const pack = state.activePack;
  $('#phasePreview').innerHTML = '';
  if (!pack) return;
  $('#practice-title').textContent = pack.session.title || 'Daily practice';
  $('#practiceDurationBadge').textContent = secondsLabel(totalDuration(pack));
  pack.session.stages.forEach((stage, index) => {
    const row = document.createElement('article'); row.className = 'phase-row';
    row.innerHTML = `<div class="phase-number">${String(index + 1).padStart(2, '0')}</div><div><h3></h3><p class="muted"></p></div><div class="phase-time"></div>`;
    $('h3', row).textContent = stage.title;
    $('p', row).textContent = stage.kind || '';
    $('.phase-time', row).textContent = secondsLabel(stage.durationSec);
    $('#phasePreview').appendChild(row);
  });
}

function renderPacks() {
  const list = $('#packList');
  list.innerHTML = '';
  allPacks().forEach(pack => {
    const card = document.createElement('article');
    card.className = `card pack-card ${state.activePack?.id === pack.id ? 'active-pack' : ''}`;
    const left = document.createElement('div');
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = state.repoPacks.some(item => item.id === pack.id) ? 'REPOSITORY PACK' : 'LOCAL IMPORT';
    const heading = document.createElement('h3'); heading.textContent = pack.title;
    const description = document.createElement('p'); description.className = 'muted'; description.textContent = pack.description || '';
    const meta = document.createElement('div'); meta.className = 'pack-meta';
    [pack.version ? `v${pack.version}` : null, secondsLabel(totalDuration(pack)), pack.tradition].filter(Boolean).forEach(value => {
      const span = document.createElement('span'); span.textContent = value; meta.appendChild(span);
    });
    left.append(eyebrow, heading, description, meta);
    const button = document.createElement('button');
    button.className = state.activePack?.id === pack.id ? 'primary' : 'secondary';
    button.textContent = state.activePack?.id === pack.id ? 'Active' : 'Use this pack';
    button.disabled = state.activePack?.id === pack.id;
    button.addEventListener('click', () => {
      state.activePack = pack;
      localStorage.setItem(STORAGE.activePack, pack.id);
      renderAll();
    });
    card.append(left, button);
    list.appendChild(card);
  });
  $('#packHealth').textContent = state.repoPackErrors.length ? `${state.repoPackErrors.length} repository pack error${state.repoPackErrors.length === 1 ? '' : 's'} detected. Open diagnostics for details.` : 'Repository packs validated successfully.';
}

function renderLibrary() {
  const list = $('#libraryList');
  list.innerHTML = '';
  state.library.forEach(item => {
    const node = $('#readingCardTemplate').content.cloneNode(true);
    $('.reading-type', node).textContent = item.type;
    $('.reading-title', node).textContent = item.title;
    $('.reading-author', node).textContent = item.author || '';
    $('.reading-description', node).textContent = item.description || '';
    const actions = $('.reading-actions', node);
    const open = document.createElement('button');
    open.className = 'secondary';
    open.textContent = item.localPath ? 'Read in app' : 'Open source';
    open.addEventListener('click', () => openReading(item));
    actions.appendChild(open);
    list.appendChild(node);
  });
}

async function openReading(item) {
  if (item.externalUrl) {
    window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!item.localPath || !isSafeLocalPath(item.localPath)) return;
  try {
    const response = await fetch(item.localPath);
    if (!response.ok) throw new Error(`Reading returned HTTP ${response.status}.`);
    showReader(item.title, await response.text());
  } catch (err) {
    showReader(item.title, `# Reading unavailable\n\n${err.message || 'The reading could not be loaded.'}`);
  }
}

function showReader(title, text) {
  $('#readerTitle').textContent = title;
  $('#readerBody').innerHTML = markdownToHtml(text);
  $('#reader').classList.remove('hidden');
  showView('library');
  setTimeout(() => $('#reader').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }), 50);
}

function openPersonalText(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) { setDataStatus('That text file is too large to open here.'); event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => showReader(file.name.replace(/\.(md|txt)$/i, ''), String(reader.result || ''));
  reader.readAsText(file);
  event.target.value = '';
}

function markdownToHtml(markdown) {
  const escaped = String(markdown).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = escaped.split(/\r?\n/);
  let html = '';
  let listType = null;
  const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
  const inline = value => value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (/^## /.test(line)) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (/^# /.test(line)) { closeList(); html += `<h1>${inline(line.slice(2))}</h1>`; }
    else if (/^&gt; /.test(line)) { closeList(); html += `<blockquote>${inline(line.slice(5))}</blockquote>`; }
    else if (/^\d+\. /.test(line)) { if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; } html += `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`; }
    else if (/^- /.test(line)) { if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; } html += `<li>${inline(line.slice(2))}</li>`; }
    else if (!line.trim()) closeList();
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

function importPack(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) { $('#packImportStatus').textContent = 'That practice pack is too large.'; event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const pack = JSON.parse(String(reader.result));
      const validation = validatePackDetailed(pack);
      if (!validation.valid) throw new Error(validation.errors.slice(0, 4).join(' '));
      const index = state.importedPacks.findIndex(item => item.id === pack.id);
      if (index >= 0) state.importedPacks[index] = pack;
      else state.importedPacks.push(pack);
      if (!writeJson(STORAGE.importedPacks, state.importedPacks)) throw new Error('Browser storage is unavailable or full.');
      state.activePack = pack;
      localStorage.setItem(STORAGE.activePack, pack.id);
      $('#packImportStatus').textContent = `Installed “${pack.title}” v${pack.version}.`;
      renderAll();
    } catch (err) {
      $('#packImportStatus').textContent = `Import rejected: ${err.message || 'invalid practice pack.'}`;
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function saveQuickLog(event) {
  event.preventDefault();
  const text = $('#quickLogText').value.trim();
  if (!text) return;
  const logs = readJson(STORAGE.logs, []);
  logs.unshift({ date: new Date().toISOString(), packId: state.activePack?.id || null, text });
  if (writeJson(STORAGE.logs, logs.slice(0, 200))) {
    $('#quickLogText').value = '';
    renderLastLog();
  }
}

function renderLastLog() {
  const log = readJson(STORAGE.logs, []).find(item => !item.system);
  $('#lastLog').textContent = log ? `Last note · ${new Date(log.date).toLocaleDateString()}: ${log.text}` : 'No sitting note recorded yet.';
}

async function beginPractice() {
  const pack = state.activePack;
  if (!pack || state.practice) return;
  if (!$('#settingsPanel').classList.contains('hidden')) closeSettings();
  if (state.settings.bell) ensureAudio();
  preloadPackImages(pack);
  state.practiceOpener = document.activeElement;
  state.practice = {
    pack,
    clock: createClock(pack.session.stages, Date.now()),
    stageIndex: 0,
    timer: null,
    lastAnnouncementKey: null,
    startedAtIso: new Date().toISOString(),
    manualNavigation: false
  };
  $('#practiceOverlay').classList.remove('hidden');
  setBackgroundInert(true);
  document.body.classList.add('practice-active');
  document.body.style.overflow = 'hidden';
  renderUpdateState();
  if (state.settings.wake) await requestWakeLock();
  transitionSignal(false);
  renderPracticeStage(practicePosition(state.practice.clock));
  $('#pausePractice').focus({ preventScroll: true });
  state.practice.timer = setInterval(tickPractice, 200);
}

function tickPractice() {
  if (!state.practice) return;
  syncPractice(false);
}

function syncPractice(forceStageRender = false) {
  const practice = state.practice;
  if (!practice) return;
  const position = practicePosition(practice.clock, Date.now());
  if (position.complete) {
    transitionSignal(true);
    endPractice(true);
    return;
  }
  const changed = position.stageIndex !== practice.stageIndex;
  if (changed) {
    practice.stageIndex = position.stageIndex;
    practice.lastAnnouncementKey = null;
    transitionSignal(position.stageIndex === practice.pack.session.stages.length - 1);
  }
  if (changed || forceStageRender) renderPracticeStage(position);
  else renderPracticeTime(position);
}

function renderPracticeStage(position = practicePosition(state.practice.clock)) {
  const practice = state.practice;
  if (!practice) return;
  const stage = practice.pack.session.stages[position.stageIndex];
  practice.stageIndex = position.stageIndex;
  $('#overlayPhaseIndex').textContent = `PHASE ${position.stageIndex + 1} OF ${practice.pack.session.stages.length}`;
  $('#overlayKind').textContent = stage.kind || 'Practice';
  $('#overlayTitle').textContent = stage.title;
  $('#overlayInstruction').textContent = stage.instruction;
  $('#overlaySecondary').textContent = stage.secondary || '';
  $('#pausePractice').textContent = practice.clock.paused ? 'Resume' : 'Pause';
  announcePractice(`${stage.title}. ${stage.instruction}`, `stage:${position.stageIndex}`);
  renderPracticeTime(position);
}

function renderPracticeTime(position = practicePosition(state.practice.clock)) {
  const practice = state.practice;
  if (!practice) return;
  const stage = practice.pack.session.stages[position.stageIndex];
  const remaining = Math.max(0, stage.durationSec - position.stageElapsedSec);
  $('#overlayTimer').textContent = clockLabel(remaining);
  $('#timerProgress').style.width = `${Math.min(100, (position.stageElapsedSec / stage.durationSec) * 100)}%`;
  const substep = activeSubstep(stage, position.stageElapsedSec);
  const cue = activeCue(stage, position.stageElapsedSec);
  const substepText = substep ? `${substep.title}${substep.cue ? ` · ${substep.cue}` : ''}` : '';
  $('#overlaySubstep').textContent = substepText || cue?.text || '';
  renderPracticeVisual(stage, substep);
  if (substep) announcePractice(substepText, `sub:${position.stageIndex}:${substep.index}`);
  else if (cue) announcePractice(cue.text, `cue:${position.stageIndex}:${cue.index}`);
}

function announcePractice(text, key) {
  const practice = state.practice;
  if (!practice || !text || practice.lastAnnouncementKey === key) return;
  practice.lastAnnouncementKey = key;
  $('#overlayAnnouncement').textContent = text;
}

function renderPracticeVisual(stage, substepInfo) {
  const substep = substepInfo?.value || null;
  const visual = substep?.imagePath || stage.imagePath;
  const wrap = $('#overlayVisualWrap');
  const image = $('#overlayVisual');
  if (!visual || !isSafeLocalPath(visual)) {
    wrap.classList.add('hidden');
    image.removeAttribute('src');
    image.alt = '';
    return;
  }
  if (image.getAttribute('src') !== visual) image.src = visual;
  image.alt = substep?.imageAlt || stage.imageAlt || substep?.title || stage.title || 'Practice visual';
  wrap.classList.remove('hidden');
}

function preloadPackImages(pack) {
  const paths = [];
  (pack?.session?.stages || []).forEach(stage => {
    if (isSafeLocalPath(stage.imagePath)) paths.push(stage.imagePath);
    (stage.substeps || []).forEach(substep => { if (isSafeLocalPath(substep.imagePath)) paths.push(substep.imagePath); });
  });
  [...new Set(paths)].forEach(path => { const image = new Image(); image.src = path; });
}

function activeSubstep(stage, elapsed) {
  if (!stage.substeps?.length) return null;
  let cursor = 0;
  for (let index = 0; index < stage.substeps.length; index += 1) {
    const value = stage.substeps[index];
    cursor += Number(value.durationSec || 0);
    if (elapsed < cursor) return { value, index };
  }
  return { value: stage.substeps.at(-1), index: stage.substeps.length - 1 };
}

function activeCue(stage, elapsed) {
  if (!stage.cues?.length) return null;
  let active = null;
  stage.cues.forEach((cue, index) => {
    if (elapsed >= cue.atSec && elapsed <= cue.atSec + 20) active = { ...cue, index };
  });
  return active;
}

function togglePause() {
  const practice = state.practice;
  if (!practice) return;
  if (practice.clock.paused) resumeClock(practice.clock, Date.now());
  else pauseClock(practice.clock, Date.now());
  $('#pausePractice').textContent = practice.clock.paused ? 'Resume' : 'Pause';
  syncPractice(true);
}

function advanceStage(delta) {
  const practice = state.practice;
  if (!practice) return;
  const current = practicePosition(practice.clock, Date.now()).stageIndex;
  const next = current + delta;
  practice.manualNavigation = true;
  if (next >= practice.pack.session.stages.length) {
    transitionSignal(true);
    endPractice(true);
    return;
  }
  if (next < 0) return;
  if (!seekClockToStage(practice.clock, next, Date.now())) return;
  practice.stageIndex = next;
  practice.lastAnnouncementKey = null;
  transitionSignal(next === practice.pack.session.stages.length - 1);
  renderPracticeStage(practicePosition(practice.clock, Date.now()));
}

async function endPractice(completed) {
  const practice = state.practice;
  if (!practice) return;
  const finalPosition = practicePosition(practice.clock, Date.now());
  const elapsedSec = Math.round(finalPosition.sessionElapsedSec);
  clearInterval(practice.timer);
  state.practice = null;
  $('#practiceOverlay').classList.add('hidden');
  setBackgroundInert(false);
  document.body.classList.remove('practice-active');
  document.body.style.overflow = '';
  $('#overlayAnnouncement').textContent = '';
  await releaseWakeLock();
  if (completed) {
    const logs = readJson(STORAGE.logs, []);
    logs.unshift({
      date: new Date().toISOString(),
      startedAt: practice.startedAtIso,
      packId: practice.pack.id,
      packVersion: practice.pack.version || null,
      text: 'Sitting completed.',
      system: true,
      durationSec: elapsedSec,
      scheduledDurationSec: totalDuration(practice.pack),
      manualNavigation: Boolean(practice.manualNavigation)
    });
    writeJson(STORAGE.logs, logs.slice(0, 200));
    showView('today');
    $('#quickLogText').placeholder = practice.pack.afterPractice?.logPrompt || 'What repeatedly captured the mind?';
    $('#quickLogText').focus();
  } else {
    state.practiceOpener?.focus?.({ preventScroll: true });
  }
  state.practiceOpener = null;
  renderLastLog();
  renderUpdateState();
}

function ensureAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  try {
    if (!state.audioContext) state.audioContext = new AudioCtor();
    if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(() => {});
  } catch (err) {
    console.warn('Audio unavailable.', err);
  }
}

function transitionSignal(final = false) {
  if (state.settings.vibrate && typeof navigator.vibrate === 'function') navigator.vibrate(final ? [35, 80, 35] : 35);
  if (!state.settings.bell) return;
  ensureAudio();
  const context = state.audioContext;
  if (!context) return;
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(final ? 0.12 : 0.08, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 3.2 : 2.2));
  master.connect(context.destination);
  const frequencies = final ? [392, 588, 784, 1176] : [440, 660, 880];
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.5 / (index + 1), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 3 : 2));
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + (final ? 3.2 : 2.2));
  });
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || state.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener?.('release', () => { state.wakeLock = null; }, { once: true });
  } catch {
    state.wakeLock = null;
  }
}

async function releaseWakeLock() {
  const lock = state.wakeLock;
  state.wakeLock = null;
  try { await lock?.release(); } catch {}
}

async function exportBackup() {
  const backup = {
    format: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    data: {
      settings: state.settings,
      importedPacks: state.importedPacks,
      activePack: state.activePack?.id || localStorage.getItem(STORAGE.activePack) || null,
      logs: readJson(STORAGE.logs, [])
    }
  };
  downloadText(`still-pine-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  setDataStatus('Backup exported. It contains local settings, imported packs, and practice records.');
}

function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES * 4) { setDataStatus('Backup rejected: file is unexpectedly large.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(String(reader.result));
      if (backup?.format !== BACKUP_FORMAT || !backup.data || typeof backup.data !== 'object') throw new Error('Not a Still Pine backup.');
      const importedPacks = Array.isArray(backup.data.importedPacks) ? backup.data.importedPacks : [];
      const invalidPack = importedPacks.find(pack => !validatePack(pack));
      if (invalidPack) throw new Error(`Backup contains an invalid practice pack${invalidPack?.id ? ` (${invalidPack.id})` : ''}.`);
      const settings = sanitizeSettings(backup.data.settings);
      const logs = sanitizeLogs(backup.data.logs);
      const activePack = typeof backup.data.activePack === 'string' ? backup.data.activePack : '';
      if (!window.confirm('Restore this Still Pine backup? Current local settings, imported packs, and practice records will be replaced.')) return;
      replaceLocalState({ settings, importedPacks, logs, activePack });
      location.reload();
    } catch (err) {
      setDataStatus(`Backup rejected: ${err.message || 'invalid backup.'}`);
    }
  };
  reader.readAsText(file);
}

function replaceLocalState({ settings, importedPacks, logs, activePack }) {
  const keys = [STORAGE.settings, STORAGE.importedPacks, STORAGE.logs, STORAGE.activePack];
  const before = new Map(keys.map(key => [key, localStorage.getItem(key)]));
  try {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    localStorage.setItem(STORAGE.importedPacks, JSON.stringify(importedPacks));
    localStorage.setItem(STORAGE.logs, JSON.stringify(logs));
    if (activePack) localStorage.setItem(STORAGE.activePack, activePack);
    else localStorage.removeItem(STORAGE.activePack);
  } catch (err) {
    for (const [key, value] of before) {
      try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {}
    }
    throw new Error('Browser storage could not be replaced safely. Existing local data was restored.');
  }
}

function sanitizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    bell: typeof source.bell === 'boolean' ? source.bell : defaultSettings.bell,
    vibrate: typeof source.vibrate === 'boolean' ? source.vibrate : defaultSettings.vibrate,
    wake: typeof source.wake === 'boolean' ? source.wake : defaultSettings.wake,
    readerSize: Math.min(26, Math.max(17, Number(source.readerSize) || defaultSettings.readerSize))
  };
}

function sanitizeLogs(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200)
    .filter(item => item && typeof item === 'object' && typeof item.date === 'string' && typeof item.text === 'string')
    .map(item => {
      const clean = {
        date: item.date.slice(0, 64),
        packId: typeof item.packId === 'string' ? item.packId.slice(0, 200) : null,
        text: item.text.slice(0, 1000)
      };
      if (typeof item.startedAt === 'string') clean.startedAt = item.startedAt.slice(0, 64);
      if (typeof item.packVersion === 'string') clean.packVersion = item.packVersion.slice(0, 64);
      if (item.system === true) clean.system = true;
      if (Number.isFinite(Number(item.durationSec))) clean.durationSec = Math.max(0, Math.round(Number(item.durationSec)));
      if (Number.isFinite(Number(item.scheduledDurationSec))) clean.scheduledDurationSec = Math.max(0, Math.round(Number(item.scheduledDurationSec)));
      if (typeof item.manualNavigation === 'boolean') clean.manualNavigation = item.manualNavigation;
      return clean;
    });
}

function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    setDataStatus('Persistent-storage requests are not supported by this browser. Backup export remains available.');
    return;
  }
  try {
    const granted = await navigator.storage.persist();
    setDataStatus(granted ? 'Browser storage is marked persistent on this device.' : 'The browser did not grant persistent storage. Keep periodic local backups.');
  } catch {
    setDataStatus('Could not request persistent storage. Keep periodic local backups.');
  }
  await refreshStorageStatus();
}

async function refreshStorageStatus() {
  const target = $('#storageStatus');
  if (!target) return;
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const parts = [];
    if (persisted != null) parts.push(persisted ? 'persistent' : 'browser-managed');
    if (estimate?.usage != null) parts.push(`${formatBytes(estimate.usage)} used`);
    target.textContent = parts.length ? `Local storage: ${parts.join(' · ')}.` : 'Local browser storage is in use.';
  } catch {
    target.textContent = 'Local browser storage is in use.';
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setDataStatus(message) {
  const target = $('#dataStatus');
  if (target) target.textContent = message;
}

async function buildDiagnostics() {
  let persisted = 'unknown';
  let storageUsage = 'unknown';
  try { if (navigator.storage?.persisted) persisted = String(await navigator.storage.persisted()); } catch {}
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      storageUsage = estimate?.usage != null ? formatBytes(estimate.usage) : 'unknown';
    }
  } catch {}
  return [
    'STILL PINE DIAGNOSTICS',
    `App version: ${APP_VERSION}`,
    `Active pack: ${state.activePack ? `${state.activePack.id}@${state.activePack.version || 'unknown'}` : 'none'}`,
    `Repository packs: ${state.repoPacks.length}`,
    `Repository pack errors: ${state.repoPackErrors.length}`,
    ...state.repoPackErrors.map(error => `  - ${error}`),
    `Imported packs: ${state.importedPacks.length}`,
    `Practice records: ${readJson(STORAGE.logs, []).length}`,
    `Display mode: ${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}`,
    `Online: ${navigator.onLine}`,
    `Service worker controlled: ${Boolean(navigator.serviceWorker?.controller)}`,
    `Update waiting: ${Boolean(state.pendingUpdate?.waiting)}`,
    `Wake Lock API: ${'wakeLock' in navigator}`,
    `Vibration API: ${typeof navigator.vibrate === 'function'}`,
    `Persistent storage: ${persisted}`,
    `Origin storage usage: ${storageUsage}`,
    `Viewport: ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio || 1}x`,
    `User agent: ${navigator.userAgent}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Practice-note contents are intentionally excluded.'
  ].join('\n');
}

async function copyDiagnostics() {
  const report = await buildDiagnostics();
  try {
    await copyText(report);
    setDataStatus('Diagnostics copied. Practice-note contents were not included.');
  } catch {
    downloadText(`still-pine-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`, report);
    setDataStatus('Clipboard access was unavailable, so diagnostics were downloaded instead.');
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  if (!ok) throw new Error('Clipboard unavailable.');
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    $('#updateStatus').textContent = 'Service workers are unavailable in this browser.';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    state.swRegistration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(registration);
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (state.reloadingForUpdate) location.reload();
    });
    $('#updateStatus').textContent = navigator.serviceWorker.controller ? 'Offline engine active.' : 'Offline engine installed; it will control the next load.';
    registration.update().catch(() => {});
  } catch (err) {
    $('#updateStatus').textContent = 'Offline engine registration failed.';
    console.warn('Service worker registration failed.', err);
  }
}

function onUpdateReady(registration) {
  state.pendingUpdate = registration;
  renderUpdateState();
}

function renderUpdateState() {
  const notice = $('#updateNotice');
  if (!state.pendingUpdate?.waiting) {
    notice.classList.add('hidden');
    return;
  }
  if (state.practice) {
    notice.classList.add('hidden');
    $('#updateStatus').textContent = 'An application update is ready and is being held until the sitting ends.';
    return;
  }
  if (!$('#settingsPanel').classList.contains('hidden')) {
    notice.classList.add('hidden');
    $('#updateStatus').textContent = 'An application update is ready. Close settings to apply it.';
    return;
  }
  $('#updateStatus').textContent = 'An application update is ready to apply.';
  notice.classList.remove('hidden');
}

function applyPendingUpdate() {
  const worker = state.pendingUpdate?.waiting;
  if (!worker || state.practice) return;
  state.reloadingForUpdate = true;
  worker.postMessage({ type: 'SKIP_WAITING' });
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

init();
