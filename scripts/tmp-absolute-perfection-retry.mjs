import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/valen/Aberamentho-s-Pleroma-music';
process.chdir(ROOT);

function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(path.join(ROOT, '.env'));
loadEnv(path.join(ROOT, '.env.local'));

const ABS = '7r3bXS3ov02maJKUL3h1d7';
const TOK = path.join(ROOT, 'data', 'spotify-tokens.json');
const tokens = JSON.parse(readFileSync(TOK, 'utf8'));
const tr = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: process.env.SPOTIFY_CLIENT_ID,
  }),
});
const tj = await tr.json();
if (!tr.ok) throw new Error(JSON.stringify(tj));
tokens.accessToken = tj.access_token;
if (tj.refresh_token) tokens.refreshToken = tj.refresh_token;
writeFileSync(TOK, JSON.stringify(tokens, null, 2));
const auth = { Authorization: 'Bearer ' + tokens.accessToken, 'Content-Type': 'application/json' };

const queries = [
  'Somewhere Clear Blue Markus Schulz Extended',
  'Ligaya Extended Vocal Gouryella',
  'Walhalla Extended Vocal Gouryella',
  'Breathing Airwave Original Club Rank 1',
  'Seven Cities Solarstone Extended Atlantis',
  'Clear Blue Water OceanLab Original',
  'Satellite Above Beyond OceanLab Extended',
  'On A Good Day Metropolis OceanLab Extended',
  'Alone Tonight Above Beyond Club',
  'Sun Moon Above Beyond Original',
  'Listening Aly Fila Extended',
  'Burned With Desire Rising Star Extended',
  'Communication Part 3 Extended Armin',
  'Concrete Angel Gareth Emery Original',
  'Beauty of Silence Svenson Gielen Remastered',
  'Liberation Fly Like An Angel Ferry Extended',
  'Carte Blanche Veracocha Extended',
  'Universal Nation Real Anthem Push',
  'Synaesthesia En-Motion Extended',
  'My Religion Pulser Original',
  'Offshore Chicane Extended',
  'No Ordinary Morning Chicane Extended',
  'Unity Solarstone Pure Orkidea',
  'Leap of Faith Solarstone Pure',
  'Children Dream Version Robert Miles',
];

async function haveIds() {
  const ids = new Set();
  let url = 'https://api.spotify.com/v1/playlists/' + ABS + '/items?limit=100';
  while (url) {
    const r = await fetch(url, { headers: { Authorization: auth.Authorization } });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d));
    for (const row of d.items || []) {
      const t = row.item || row.track;
      if (t?.id) ids.add(t.id);
    }
    url = d.next;
    await new Promise((res) => setTimeout(res, 250));
  }
  return ids;
}

const have = await haveIds();
console.log('have', have.size);
const add = [];
for (const q of queries) {
  await new Promise((r) => setTimeout(r, 400));
  const r = await fetch(
    'https://api.spotify.com/v1/search?' + new URLSearchParams({ q, type: 'track', limit: '3' }),
    { headers: { Authorization: auth.Authorization } },
  );
  if (r.status === 429) {
    console.log('search 429, waiting');
    await new Promise((x) => setTimeout(x, 20000));
    continue;
  }
  const d = await r.json();
  const h = d.tracks?.items?.[0];
  if (!h || have.has(h.id) || add.some((x) => x.id === h.id)) continue;
  add.push({ id: h.id, uri: h.uri, name: h.name });
  console.log('+', h.name);
}
console.log('to add', add.length);
if (add.length) {
  await new Promise((r) => setTimeout(r, 3000));
  const res = await fetch('https://api.spotify.com/v1/playlists/' + ABS + '/items', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ uris: add.map((a) => a.uri) }),
  });
  console.log('ADD', res.status, await res.text());
}
console.log('Absolute now', (await haveIds()).size);
console.log('https://open.spotify.com/playlist/' + ABS);
