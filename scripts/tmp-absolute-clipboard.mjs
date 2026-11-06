/**
 * Absolute — paste jewel open.spotify.com URLs to clipboard (Ctrl+V).
 * No Spotify API ADD. Uses local backups while QUOTA_EXCEEDED.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'C:\\Users\\valen\\Aberamentho-s-Pleroma-music';
const DATA = path.join(ROOT, 'data');

function loadJson(file) {
  const p = path.join(DATA, file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

const backup = loadJson('absolute-backup-jewels-1793808249610.json');
const tracks = Array.isArray(backup)
  ? backup
  : backup?.tracks || backup?.items || backup?.selected || [];
const byId = new Map();
for (const t of tracks) if (t?.id) byId.set(t.id, t);

const harvest = loadJson('absolute-harvest-resolved.json') || [];
const jewels = loadJson('absolute-jewels-add.json');
const jewelSel = jewels?.selected || [];

const prefer = [
  '5UclhffLhYHkmAk7rTlxtR',
  '0C1qMhrxWOtLgOLL6yXy84',
  '2MklgC4mTu7ERKCfOuDnyb',
  '73gibd57cbwAPJ64KZZbfL',
  '03jMSKaqxq8e47asdJWmf9',
  '53RvV6KioUjQuBFNLseks1',
  '4jM0zZPDschVSpZPuBhaxL',
  '1Oyf1L1UQmKeFsHa12Kk8d',
  '5VIVZAQVSfJRD8f4XFbgBL',
  '1MGXnOrS52N8bt2ceoezp5',
  '0d4OveyI9nqkPobcPHc0M7',
  '29pmOaGlEO8kRFwvFKbpTj',
  '3VkBcIslOf1Am8RaXjhJQy',
  '5WOVVQGh4yJx6yxQu6ou4q',
  '2NXgCETSP6neHpo6PQaDvj',
  '6nADKegRpGFxj5aPeQoFC1',
  '6eYjUe4LXsV5u76ymGObqS',
  '443jJ9JZQmnMBGn2ZhNYxK',
  '4TjA8QfH9JNKXyzaAaP6Uc',
  '4wtR6HB3XekEengMX17cpc',
];

const EXTRA =
  /concrete angel|beauty of silence|on a good day|leap of faith|liberation|for an angel|gamemaster|as the rush comes|greece 2000|cafe del mar|solstice|out of the blue|carte blanche|my religion|saltwater|offshore|tenshi|blue fear|age of love|adagio|leben|fiji|3rd earth|eye of horus|communication|sun.?and.?moon|sun & moon/i;

for (const t of [...jewelSel, ...tracks]) {
  const n = String(t?.name || '');
  if (EXTRA.test(n) && t.id && !prefer.includes(t.id)) prefer.push(t.id);
}
for (const h of harvest) {
  if (h?.id && !prefer.includes(h.id)) prefer.push(h.id);
}

const seen = new Set();
const urls = [];
const labeled = [];
const uris = [];

for (const id of prefer) {
  if (seen.has(id)) continue;
  seen.add(id);
  const t =
    byId.get(id) ||
    harvest.find((x) => x.id === id) ||
    jewelSel.find((x) => x.id === id) ||
    { id, name: id, artists: '' };
  const url = `https://open.spotify.com/track/${id}`;
  urls.push(url);
  uris.push(`spotify:track:${id}`);
  labeled.push(`${t.name || id} — ${t.artists || ''} | ${url}`);
}

const urlsPath = path.join(DATA, 'absolute-paste-urls.txt');
const listPath = path.join(DATA, 'absolute-paste-list.txt');
const urisPath = path.join(DATA, 'absolute-paste-uris.txt');
writeFileSync(urlsPath, urls.join('\n'), 'utf8');
writeFileSync(listPath, labeled.join('\n'), 'utf8');
writeFileSync(urisPath, uris.join('\n'), 'utf8');

execFileSync(
  'powershell.exe',
  ['-NoProfile', '-Command', `Set-Clipboard -Value (Get-Content -Raw -LiteralPath '${urlsPath}')`],
  { stdio: 'inherit' },
);

console.log(JSON.stringify({ clipboard: true, count: urls.length, urlsPath, listPath, urisPath }, null, 2));
console.log('--- TOP 15 ---');
for (const line of labeled.slice(0, 15)) console.log(line);
