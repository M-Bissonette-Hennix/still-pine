const STORAGE = {
  settings: 'stillPine.settings.v1',
  importedPacks: 'stillPine.importedPacks.v1',
  activePack: 'stillPine.activePack.v1',
  logs: 'stillPine.logs.v1'
};

const defaultSettings = { bell: true, vibrate: true, wake: true, readerSize: 20 };
const state = {
  settings: { ...defaultSettings, ...readJson(STORAGE.settings, {}) },
  repoPacks: [],
  importedPacks: readJson(STORAGE.importedPacks, []),
  activePack: null,
  library: [],
  wakeLock: null,
  practice: null,
  audioContext: null
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function secondsLabel(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}
function clockLabel(sec) {
  const n = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
}
function totalDuration(pack) { return pack?.session?.stages?.reduce((n, s) => n + Number(s.durationSec || 0), 0) || 0; }
function allPacks() {
  const map = new Map();
  [...state.repoPacks, ...state.importedPacks].forEach(p => map.set(p.id, p));
  return [...map.values()];
}

async function init() {
  bindNavigation();
  bindSettings();
  bindStaticActions();
  applySettings();
  await Promise.all([loadPacks(), loadLibrary()]);
  chooseActivePack();
  renderAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

async function loadPacks() {
  try {
    const manifest = await fetch('./content/manifest.json', { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('manifest');
      return r.json();
    });
    state.repoPacks = (await Promise.all((manifest.packs || []).map(path => fetch(path, { cache:'no-store' }).then(r => r.json()))))
      .filter(validatePack);
  } catch (err) {
    console.warn('Could not load repository packs.', err);
  }
}

async function loadLibrary() {
  try {
    const data = await fetch('./content/readings/library.json', { cache:'no-store' }).then(r => r.json());
    state.library = data.items || [];
  } catch (err) {
    console.warn('Could not load reading library.', err);
  }
}

function chooseActivePack() {
  const packs = allPacks();
  const preferred = localStorage.getItem(STORAGE.activePack);
  state.activePack = packs.find(p => p.id === preferred) || packs[0] || null;
  if (state.activePack) localStorage.setItem(STORAGE.activePack, state.activePack.id);
}

function bindNavigation() {
  $$('.tab').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
}

function showView(name) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  $('#app').focus({preventScroll:true});
  window.scrollTo({top:0, behavior:'smooth'});
}

function bindSettings() {
  $('#settingsButton').addEventListener('click', openSettings);
  $('#closeSettings').addEventListener('click', closeSettings);
  $('#scrim').addEventListener('click', closeSettings);
  $('#settingBell').addEventListener('change', saveSettings);
  $('#settingVibrate').addEventListener('change', saveSettings);
  $('#settingWake').addEventListener('change', saveSettings);
  $('#settingFontSize').addEventListener('input', saveSettings);
}

function openSettings() {
  $('#settingsPanel').classList.remove('hidden');
  $('#scrim').classList.remove('hidden');
}
function closeSettings() {
  $('#settingsPanel').classList.add('hidden');
  $('#scrim').classList.add('hidden');
}
function applySettings() {
  $('#settingBell').checked = state.settings.bell;
  $('#settingVibrate').checked = state.settings.vibrate;
  $('#settingWake').checked = state.settings.wake;
  $('#settingFontSize').value = state.settings.readerSize;
  document.documentElement.style.setProperty('--reader-size', `${state.settings.readerSize}px`);
}
function saveSettings() {
  state.settings = {
    bell: $('#settingBell').checked,
    vibrate: $('#settingVibrate').checked,
    wake: $('#settingWake').checked,
    readerSize: Number($('#settingFontSize').value)
  };
  writeJson(STORAGE.settings, state.settings);
  applySettings();
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
  $('#closeReader').addEventListener('click', () => $('#reader').classList.add('hidden'));
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.practice && state.settings.wake) await requestWakeLock();
  });
}

function renderAll() {
  renderToday();
  renderPracticePreview();
  renderPacks();
  renderLibrary();
}

function renderToday() {
  const p = state.activePack;
  if (!p) {
    $('#today-description').textContent = 'No practice pack is installed.';
    $('#startFromToday').disabled = true;
    return;
  }
  $('#today-title').textContent = p.title;
  $('#today-description').textContent = p.description || '';
  $('#weeklyTeaching').textContent = p.weeklyTeaching || '';
  $('#weeklyTeachingNote').textContent = p.weeklyTeachingNote || '';
  $('#sessionLength').textContent = `${secondsLabel(totalDuration(p))} · ${p.session.stages.length} phases`;
  $('#inquiryList').innerHTML = '';
  (p.afterPractice?.inquiries || []).forEach(q => {
    const el = document.createElement('p');
    el.className = 'inquiry-question'; el.textContent = q;
    $('#inquiryList').appendChild(el);
  });
  if (p.study?.contemplation) {
    const c = document.createElement('p');
    c.className = 'muted'; c.textContent = p.study.contemplation;
    $('#inquiryList').appendChild(c);
  }
  const reading = (p.study?.assignedReadingIds || []).map(id => state.library.find(r => r.id === id)).find(Boolean);
  $('#todayReading').innerHTML = '';
  if (reading) $('#todayReading').appendChild(makeReadingCompact(reading));
  renderLastLog();
}

function makeReadingCompact(item) {
  const wrap = document.createElement('div');
  const h = document.createElement('h3'); h.textContent = item.title;
  const p = document.createElement('p'); p.className = 'muted'; p.textContent = item.description;
  const b = document.createElement('button'); b.className = 'secondary'; b.textContent = item.localPath ? 'Read in app' : 'Open official text';
  b.addEventListener('click', () => openReading(item));
  wrap.append(h,p,b); return wrap;
}

function renderPracticePreview() {
  const p = state.activePack;
  $('#phasePreview').innerHTML = '';
  if (!p) return;
  $('#practice-title').textContent = p.session.title || 'Daily practice';
  $('#practiceDurationBadge').textContent = secondsLabel(totalDuration(p));
  p.session.stages.forEach((stage, i) => {
    const row = document.createElement('article'); row.className = 'phase-row';
    row.innerHTML = `<div class="phase-number">${String(i+1).padStart(2,'0')}</div><div><h3></h3><p class="muted"></p></div><div class="phase-time"></div>`;
    $('h3', row).textContent = stage.title;
    $('p', row).textContent = stage.kind || '';
    $('.phase-time', row).textContent = secondsLabel(stage.durationSec);
    $('#phasePreview').appendChild(row);
  });
}

function renderPacks() {
  const list = $('#packList'); list.innerHTML = '';
  allPacks().forEach(pack => {
    const card = document.createElement('article');
    card.className = `card pack-card ${state.activePack?.id === pack.id ? 'active-pack' : ''}`;
    const left = document.createElement('div');
    const eye = document.createElement('p'); eye.className='eyebrow'; eye.textContent = state.repoPacks.some(p=>p.id===pack.id) ? 'REPOSITORY PACK' : 'LOCAL IMPORT';
    const h = document.createElement('h3'); h.textContent = pack.title;
    const d = document.createElement('p'); d.className='muted'; d.textContent=pack.description || '';
    const meta = document.createElement('div'); meta.className='pack-meta';
    [pack.version ? `v${pack.version}` : null, secondsLabel(totalDuration(pack)), pack.tradition].filter(Boolean).forEach(t=>{ const s=document.createElement('span');s.textContent=t;meta.appendChild(s); });
    left.append(eye,h,d,meta);
    const btn = document.createElement('button'); btn.className = state.activePack?.id === pack.id ? 'primary' : 'secondary'; btn.textContent = state.activePack?.id === pack.id ? 'Active' : 'Use this pack';
    btn.disabled = state.activePack?.id === pack.id;
    btn.addEventListener('click', () => { state.activePack = pack; localStorage.setItem(STORAGE.activePack, pack.id); renderAll(); });
    card.append(left,btn); list.appendChild(card);
  });
}

function renderLibrary() {
  const list = $('#libraryList'); list.innerHTML='';
  state.library.forEach(item => {
    const node = $('#readingCardTemplate').content.cloneNode(true);
    $('.reading-type', node).textContent = item.type;
    $('.reading-title', node).textContent = item.title;
    $('.reading-author', node).textContent = item.author || '';
    $('.reading-description', node).textContent = item.description || '';
    const actions = $('.reading-actions', node);
    const open = document.createElement('button'); open.className='secondary'; open.textContent=item.localPath?'Read in app':'Open source'; open.addEventListener('click',()=>openReading(item));
    actions.appendChild(open); list.appendChild(node);
  });
}

async function openReading(item) {
  if (item.externalUrl) {
    window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!item.localPath) return;
  const text = await fetch(item.localPath).then(r=>r.text());
  showReader(item.title, text);
}

function showReader(title, text) {
  $('#readerTitle').textContent = title;
  $('#readerBody').innerHTML = markdownToHtml(text);
  $('#reader').classList.remove('hidden');
  showView('library');
  setTimeout(()=>$('#reader').scrollIntoView({behavior:'smooth',block:'start'}), 50);
}

function openPersonalText(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => showReader(file.name.replace(/\.(md|txt)$/i,''), String(reader.result || ''));
  reader.readAsText(file);
  event.target.value='';
}

function markdownToHtml(md) {
  const esc = String(md).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = esc.split(/\r?\n/);
  let html='', inList=false;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`(.+?)`/g,'<code>$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) { if(inList){html+='</ul>';inList=false;} html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (/^## /.test(line)) { if(inList){html+='</ul>';inList=false;} html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (/^# /.test(line)) { if(inList){html+='</ul>';inList=false;} html += `<h1>${inline(line.slice(2))}</h1>`; }
    else if (/^&gt; /.test(line)) { if(inList){html+='</ul>';inList=false;} html += `<blockquote>${inline(line.slice(5))}</blockquote>`; }
    else if (/^\d+\. /.test(line)) { if(!inList){html+='<ul>';inList=true;} html += `<li>${inline(line.replace(/^\d+\. /,''))}</li>`; }
    else if (/^- /.test(line)) { if(!inList){html+='<ul>';inList=true;} html += `<li>${inline(line.slice(2))}</li>`; }
    else if (!line.trim()) { if(inList){html+='</ul>';inList=false;} }
    else { if(inList){html+='</ul>';inList=false;} html += `<p>${inline(line)}</p>`; }
  }
  if(inList) html+='</ul>';
  return html;
}

function validatePack(pack) {
  return Boolean(pack && pack.format === 'still-pine.zenpack/v1' && typeof pack.id === 'string' && pack.session && Array.isArray(pack.session.stages) && pack.session.stages.length && pack.session.stages.every(s => s.id && s.title && Number(s.durationSec) > 0 && typeof s.instruction === 'string'));
}

function importPack(event) {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const pack = JSON.parse(String(reader.result));
      if (!validatePack(pack)) throw new Error('This is not a valid Still Pine v1 practice pack.');
      const idx = state.importedPacks.findIndex(p => p.id === pack.id);
      if (idx >= 0) state.importedPacks[idx] = pack; else state.importedPacks.push(pack);
      writeJson(STORAGE.importedPacks, state.importedPacks);
      state.activePack = pack; localStorage.setItem(STORAGE.activePack, pack.id);
      $('#packImportStatus').textContent = `Installed “${pack.title}” v${pack.version || '1'}.`;
      renderAll();
    } catch(err) { $('#packImportStatus').textContent = err.message || 'Could not import that pack.'; }
  };
  reader.readAsText(file); event.target.value='';
}

function saveQuickLog(event) {
  event.preventDefault();
  const text = $('#quickLogText').value.trim(); if (!text) return;
  const logs = readJson(STORAGE.logs, []);
  logs.unshift({ date: new Date().toISOString(), packId: state.activePack?.id || null, text });
  writeJson(STORAGE.logs, logs.slice(0, 200));
  $('#quickLogText').value=''; renderLastLog();
}

function renderLastLog() {
  const log = readJson(STORAGE.logs, [])[0];
  $('#lastLog').textContent = log ? `Last note · ${new Date(log.date).toLocaleDateString()}: ${log.text}` : 'No sitting note recorded yet.';
}

async function beginPractice() {
  const pack = state.activePack; if (!pack) return;
  if (state.settings.bell) ensureAudio();
  preloadPackImages(pack);
  state.practice = { pack, stageIndex:0, stageElapsed:0, paused:false, lastTick:performance.now(), timer:null, cueKey:null };
  $('#practiceOverlay').classList.remove('hidden');
  document.body.style.overflow='hidden';
  if (state.settings.wake) await requestWakeLock();
  transitionSignal(false);
  renderPracticeStage();
  state.practice.timer = setInterval(tickPractice, 200);
}

function renderPracticeStage() {
  const p = state.practice; if (!p) return;
  const stage = p.pack.session.stages[p.stageIndex];
  $('#overlayPhaseIndex').textContent = `PHASE ${p.stageIndex + 1} OF ${p.pack.session.stages.length}`;
  $('#overlayKind').textContent = stage.kind || 'Practice';
  $('#overlayTitle').textContent = stage.title;
  $('#overlayInstruction').textContent = stage.instruction;
  $('#overlaySecondary').textContent = stage.secondary || '';
  $('#pausePractice').textContent = p.paused ? 'Resume' : 'Pause';
  renderPracticeTime();
}

function tickPractice() {
  const p = state.practice; if (!p || p.paused) return;
  const now = performance.now();
  p.stageElapsed += (now - p.lastTick) / 1000;
  p.lastTick = now;
  const stage = p.pack.session.stages[p.stageIndex];
  if (p.stageElapsed >= stage.durationSec) { advanceStage(1); return; }
  renderPracticeTime();
}

function renderPracticeTime() {
  const p = state.practice; if (!p) return;
  const stage = p.pack.session.stages[p.stageIndex];
  const remaining = Math.max(0, stage.durationSec - p.stageElapsed);
  $('#overlayTimer').textContent = clockLabel(remaining);
  $('#timerProgress').style.width = `${Math.min(100, (p.stageElapsed / stage.durationSec) * 100)}%`;
  const sub = activeSubstep(stage, p.stageElapsed);
  const cue = activeCue(stage, p.stageElapsed);
  $('#overlaySubstep').textContent = sub ? `${sub.title}${sub.cue ? ` · ${sub.cue}` : ''}` : cue || '';
  renderPracticeVisual(stage, sub);
}

function renderPracticeVisual(stage, substep) {
  const visual = substep?.imagePath || stage.imagePath;
  const wrap = $('#overlayVisualWrap');
  const img = $('#overlayVisual');
  if (!visual) {
    wrap.classList.add('hidden');
    img.removeAttribute('src');
    img.alt = '';
    return;
  }
  img.src = visual;
  img.alt = substep?.imageAlt || stage.imageAlt || substep?.title || stage.title || 'Practice visual';
  wrap.classList.remove('hidden');
}

function preloadPackImages(pack) {
  const paths = [];
  (pack?.session?.stages || []).forEach(stage => {
    if (stage.imagePath) paths.push(stage.imagePath);
    (stage.substeps || []).forEach(sub => { if (sub.imagePath) paths.push(sub.imagePath); });
  });
  [...new Set(paths)].forEach(path => { const img = new Image(); img.src = path; });
}

function activeSubstep(stage, elapsed) {
  if (!stage.substeps?.length) return null;
  let cursor = 0;
  for (const sub of stage.substeps) {
    cursor += Number(sub.durationSec || 0);
    if (elapsed < cursor) return sub;
  }
  return stage.substeps.at(-1);
}
function activeCue(stage, elapsed) {
  const cues = (stage.cues || []).filter(c => elapsed >= c.atSec && elapsed <= c.atSec + 20);
  return cues.length ? cues.at(-1).text : '';
}

function togglePause() {
  const p = state.practice; if (!p) return;
  p.paused = !p.paused; p.lastTick = performance.now();
  $('#pausePractice').textContent = p.paused ? 'Resume' : 'Pause';
}

function advanceStage(delta) {
  const p = state.practice; if (!p) return;
  const next = p.stageIndex + delta;
  if (next >= p.pack.session.stages.length) { transitionSignal(true); endPractice(true); return; }
  if (next < 0) return;
  p.stageIndex = next; p.stageElapsed = 0; p.lastTick = performance.now(); p.cueKey = null;
  transitionSignal(next === p.pack.session.stages.length - 1);
  renderPracticeStage();
}

async function endPractice(completed) {
  const p = state.practice; if (!p) return;
  clearInterval(p.timer);
  state.practice = null;
  $('#practiceOverlay').classList.add('hidden');
  document.body.style.overflow='';
  await releaseWakeLock();
  if (completed) {
    const logs = readJson(STORAGE.logs, []);
    logs.unshift({ date:new Date().toISOString(), packId:p.pack.id, text:'Sitting completed.', system:true, durationSec:totalDuration(p.pack) });
    writeJson(STORAGE.logs, logs.slice(0,200));
    showView('today');
    $('#quickLogText').focus();
    $('#quickLogText').placeholder = p.pack.afterPractice?.logPrompt || 'What repeatedly captured the mind?';
  }
  renderLastLog();
}

function ensureAudio() {
  if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(()=>{});
}

function transitionSignal(final = false) {
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(final ? [35,80,35] : 35);
  if (!state.settings.bell) return;
  ensureAudio();
  const ctx = state.audioContext; if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain(); master.gain.setValueAtTime(0.0001, now); master.gain.exponentialRampToValueAtTime(final ? 0.12 : 0.08, now + 0.02); master.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 3.2 : 2.2)); master.connect(ctx.destination);
  const freqs = final ? [392, 588, 784, 1176] : [440, 660, 880];
  freqs.forEach((f,i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle'; osc.frequency.value = f;
    g.gain.setValueAtTime(0.5 / (i+1), now); g.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 3 : 2));
    osc.connect(g); g.connect(master); osc.start(now); osc.stop(now + (final ? 3.2 : 2.2));
  });
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { state.wakeLock = await navigator.wakeLock.request('screen'); }
  catch { state.wakeLock = null; }
}
async function releaseWakeLock() {
  try { await state.wakeLock?.release(); } catch {}
  state.wakeLock = null;
}

init();
