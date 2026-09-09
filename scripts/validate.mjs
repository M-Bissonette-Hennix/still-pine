import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackDetailed, isSafeLocalPath } from '../js/pack-validator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const checks = [];
const fail = message => errors.push(message);
const ok = message => checks.push(message);
const file = relative => path.join(root, relative.replace(/^\.\//, ''));
const text = relative => readFile(file(relative), 'utf8');
const json = async relative => JSON.parse(await text(relative));

const REQUIRED = [
  '.nojekyll', 'VERSION', 'CHANGELOG.md', 'LICENSE', 'README.md', 'index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest',
  'js/practice-engine.js', 'js/pack-validator.js',
  'assets/icon-192.png', 'assets/icon-512.png',
  'content/manifest.json', 'content/readings/library.json', 'content/readings/fukanzazengi-study-notes.md',
  'schemas/zenpack.schema.json', 'templates/blank.zenpack.json',
  'docs/GITHUB-PAGES.md', 'docs/PACK-AUTHORING.md', 'docs/RELEASE-CHECKLIST.md', 'docs/QA-1.2.0.md', 'docs/RELEASE-NOTES-1.2.0.md'
];

for (const relative of REQUIRED) if (!existsSync(file(relative))) fail(`Missing required file: ${relative}`);
if (!errors.length) ok('required source tree present');

const version = (await text('VERSION')).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`VERSION is not semantic version text: ${version}`);
const app = await text('app.js');
const sw = await text('sw.js');
if (!app.includes(`const APP_VERSION = '${version}'`)) fail('app.js APP_VERSION does not match VERSION.');
if (!sw.includes(`const VERSION = '${version}'`)) fail('sw.js VERSION does not match VERSION.');
if (version === '1.2.0') ok('application/service-worker version parity');

const changelog = await text('CHANGELOG.md');
if (!changelog.includes(`## ${version} — Foundation Hardening`)) fail(`CHANGELOG.md does not contain the ${version} release entry.`);
else ok('changelog/version parity');

const parseTargets = ['manifest.webmanifest', 'content/manifest.json', 'content/readings/library.json', 'schemas/zenpack.schema.json', 'templates/blank.zenpack.json'];
for (const relative of parseTargets) {
  try { await json(relative); }
  catch (err) { fail(`Invalid JSON: ${relative}: ${err.message}`); }
}
if (!errors.some(item => item.startsWith('Invalid JSON'))) ok('JSON syntax');

const manifest = await json('content/manifest.json');
if (manifest.format !== 'still-pine.manifest/v1' || !Array.isArray(manifest.packs)) fail('Invalid content/manifest.json shape.');
const packPaths = manifest.packs || [];
for (const packPath of packPaths) {
  if (!isSafeLocalPath(packPath)) { fail(`Unsafe repository pack path: ${packPath}`); continue; }
  if (!existsSync(file(packPath))) { fail(`Repository pack does not exist: ${packPath}`); continue; }
  try {
    const pack = await json(packPath);
    const validation = validatePackDetailed(pack);
    if (!validation.valid) validation.errors.forEach(message => fail(`${packPath}: ${message}`));
  } catch (err) { fail(`Could not validate ${packPath}: ${err.message}`); }
}
if (!errors.some(item => item.includes('pack'))) ok('repository pack validation');

const foundationPath = 'content/packs/foundation-01.zenpack.json';
const foundation = await json(foundationPath);
const expectedStages = [
  ['kuji', 180], ['settling', 90], ['susokukan', 300], ['shikantaza', 900], ['closing', 60]
];
const actualStages = foundation.session.stages.map(stage => [stage.id, stage.durationSec]);
if (JSON.stringify(actualStages) !== JSON.stringify(expectedStages)) fail(`Foundation I stage timing changed: ${JSON.stringify(actualStages)}`);
if (foundation.session.stages.reduce((sum, stage) => sum + stage.durationSec, 0) !== 1530) fail('Foundation I total duration is not 1530 seconds.');
if (foundation.session.stages[0].substeps?.reduce((sum, sub) => sum + sub.durationSec, 0) !== 180) fail('Kuji substeps do not total 180 seconds.');

const provenance = {
  [foundationPath]: 'acd6c221817b6a5087f31256d2482e702dd8314d7e41b7f44e9b77d8cff0958d',
  'assets/kuji/01-rin.jpg': 'ca9f27521ccc073b086a2a1b852f42ce55d85ee4d1f4d248426d3f7b3023f2fc',
  'assets/kuji/02-pyo.jpg': '89a07ce2123c51137456252e7f7a5fed98108afa231afceb9c42c2ca28bac2d7',
  'assets/kuji/03-to.jpg': '186932eb15cb5b4c886b55ba6b85d38b5eaf934d85ff4e601c5ee28dcfa26864',
  'assets/kuji/04-sha.jpg': '15859ac2f6e2e4293e5ffb980841a3bdd203a3891594297cbd27f6d86968612a',
  'assets/kuji/05-kai.jpg': 'e276fee3776ee6e0741bf52219c8272bb6c2896f438e4e05aef2da5a944c8300',
  'assets/kuji/06-jin.jpg': '6e26eaf6463b92900c97a57ec8d99f2d9460e89c995a44f467118f2af03153f6',
  'assets/kuji/07-retsu.jpg': 'beb2e034504a8833020a7bd4e905c96b85d743a1f3216f492f50dc56a6b379fb',
  'assets/kuji/08-zai.jpg': '9797d318827f5338c9cedcc8b5ff6bcb25276e6507d9496a1e01c2da238057a8',
  'assets/kuji/09-zen.jpg': '77603e494c95a210d01b8de0294707c6ea0fb2f73bbbfa432e478225a37013a1'
};
for (const [relative, expected] of Object.entries(provenance)) {
  const buffer = await readFile(file(relative));
  const actual = createHash('sha256').update(buffer).digest('hex');
  if (actual !== expected) fail(`Protected Foundation I provenance changed: ${relative}`);
}
if (!errors.some(item => item.includes('Foundation I'))) ok('Foundation I curriculum/image provenance guard');

const library = await json('content/readings/library.json');
for (const item of library.items || []) {
  if (item.localPath) {
    if (!isSafeLocalPath(item.localPath)) fail(`Unsafe reading path: ${item.localPath}`);
    else if (!existsSync(file(item.localPath))) fail(`Missing local reading: ${item.localPath}`);
  }
}
ok('local reading paths');

const html = await text('index.html');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (/^(?:https?:|#|mailto:)/.test(ref)) continue;
  if (!isSafeLocalPath(ref)) { fail(`Unsafe/root-relative HTML asset path: ${ref}`); continue; }
  if (!existsSync(file(ref))) fail(`Broken HTML asset path: ${ref}`);
}
if (/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html)) fail('Runtime HTML loads a remote script/style asset.');
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicateHtmlIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
if (duplicateHtmlIds.length) fail(`Duplicate HTML ids: ${[...new Set(duplicateHtmlIds)].join(', ')}`);
const htmlIdSet = new Set(htmlIds);
for (const match of app.matchAll(/\$\('#([^']+)'\)/g)) if (!htmlIdSet.has(match[1])) fail(`app.js references missing HTML id: ${match[1]}`);
for (const match of html.matchAll(/\sfor="([^"]+)"/g)) if (!htmlIdSet.has(match[1])) fail(`HTML label references missing id: ${match[1]}`);
for (const match of html.matchAll(/\saria-labelledby="([^"]+)"/g)) for (const id of match[1].split(/\s+/)) if (!htmlIdSet.has(id)) fail(`aria-labelledby references missing id: ${id}`);
ok('HTML local-asset/DOM contract audit');

const coreMatch = sw.match(/const CORE = \[([\s\S]*?)\];/);
if (!coreMatch) fail('Could not locate service-worker CORE list.');
else {
  const corePaths = [...coreMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  for (const relative of corePaths) {
    if (relative === './') continue;
    if (!isSafeLocalPath(relative)) fail(`Unsafe service-worker core path: ${relative}`);
    else if (!existsSync(file(relative))) fail(`Service-worker core asset missing: ${relative}`);
  }
  for (const required of ['./app.js', './js/practice-engine.js', './js/pack-validator.js', './content/packs/foundation-01.zenpack.json']) {
    if (!corePaths.includes(required)) fail(`Service worker does not precache required core asset: ${required}`);
  }
}
if (!sw.includes("event.data?.type === 'SKIP_WAITING'")) fail('Service worker lacks deferred SKIP_WAITING message handling.');
const installBlock = sw.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/);
if (installBlock?.[0].includes('skipWaiting()')) {
  const guardedLegacyMigration = installBlock[0].includes("existing.some(key => LEGACY_CACHES.has(key))") && installBlock[0].includes('await self.skipWaiting()');
  if (!guardedLegacyMigration) fail('Service worker has an unguarded skipWaiting call during install.');
}
if (!sw.includes("'still-pine-v1.1.0'")) fail('Service worker does not recognize the v1.1 legacy cache for one-time migration.');
ok('service-worker asset/update audit');

for (const [relative, width, height] of [['assets/icon-192.png', 192, 192], ['assets/icon-512.png', 512, 512]]) {
  const buffer = await readFile(file(relative));
  if (buffer.toString('ascii', 1, 4) !== 'PNG') fail(`${relative} is not a PNG.`);
  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) fail(`${relative} has wrong dimensions: ${actualWidth}×${actualHeight}.`);
}
ok('PWA icon dimensions');

const forbidden = [];
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
    else if (/^(?:\.DS_Store|Thumbs\.db)$/i.test(entry.name)) forbidden.push(relative);
  }
}
await walk(root);
for (const relative of forbidden) fail(`Forbidden transient file: ${relative}`);

if (errors.length) {
  console.error('\nSTILL PINE RELEASE VALIDATION: FAILED\n');
  errors.forEach((message, index) => console.error(`${index + 1}. ${message}`));
  process.exitCode = 1;
} else {
  console.log(`STILL PINE RELEASE VALIDATION: PASS — v${version}`);
  checks.forEach(message => console.log(`✓ ${message}`));
}
