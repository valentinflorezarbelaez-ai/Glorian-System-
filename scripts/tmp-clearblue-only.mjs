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
const auth = { Authorization: 'Bearer ' + tokens.accessToken };

async function allItems() {
  const out = [];
  let url = 'https://api.spotify.com/v1/playlists/' + ABS + '/items?limit=100';
  while (url) {
    const r = await fetch(url, { headers: auth });
    const d = await r.json();
    for (const row of d.items || []) {
      const t = row.item || row.track;
      if (t?.id && t?.uri && (!t.type || t.type === 'track')) {
        out.push({
          id: t.id,
          uri: t.uri,
          name: t.name,
          artists: (t.artists || []).map((a) => a.name).join(', '),
        });
      }
    }
    url = d.next;
  }
  return out;
}

const have = new Set((await allItems()).map((t) => t.id));
const add = [];

for (const q of [
  'Markus Schulz Clear Blue',
  'Markus Schulz Clear Blue Extended Mix',
  'Clear Blue Markus Schulz',
  'Markus Schulz Destiny',
  'Markus Schulz The New World',
  'Markus Schulz Far From The Sanctuary',
  'Markus Schulz Afterlife Inertia',
  'Dakota Sin City',
  'OceanLab On A Good Day',
  'OceanLab Lonely Girl',
]) {
  const r = await fetch(
    'https://api.spotify.com/v1/search?' + new URLSearchParams({ q, type: 'track', limit: '8' }),
    { headers: auth },
  );
  const d = await r.json();
  for (const h of d.tracks?.items || []) {
    const artists = (h.artists || []).map((a) => a.name).join(', ');
    if (q.toLowerCase().includes('clear blue')) {
      if (!/clear\s*blue/i.test(h.name)) continue;
      if (!/markus\s*schulz|dakota/i.test(artists)) continue;
    }
    if (have.has(h.id) || add.some((x) => x.id === h.id)) continue;
    add.push({ id: h.id, uri: h.uri, name: h.name, artists });
    console.log('+', h.name, '-', artists);
    if (!q.toLowerCase().includes('clear blue')) break;
  }
}

if (add.length) {
  const res = await fetch('https://api.spotify.com/v1/playlists/' + ABS + '/items', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: add.map((a) => a.uri) }),
  });
  console.log('ADD', res.status, await res.text());
}

writeFileSync(
  path.join(ROOT, 'data', 'absolute-user-apex-prefs.json'),
  JSON.stringify(
    {
      alwaysKeep: ['Markus Schulz - Clear Blue'],
      loop: 'User listens Absolute and names keep/cut tracks; agent ADDs jewels only',
      absolute: ABS,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log('Absolute now', (await allItems()).length);
console.log('https://open.spotify.com/playlist/' + ABS);
