/**
 * Absolute — force ADD known URIs (no playlist scan). ADD-only.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'C:\\Users\\valen\\Aberamentho-s-Pleroma-music';
process.chdir(ROOT);

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';
const tokens = JSON.parse(readFileSync(TOK, 'utf8'));

const uris = [
  'spotify:track:5UclhffLhYHkmAk7rTlxtR', // Clear Blue Extended
  'spotify:track:73gibd57cbwAPJ64KZZbfL', // Ligaya Extended Vocal
  'spotify:track:53RvV6KioUjQuBFNLseks1', // Walhalla Extended
  'spotify:track:1Oyf1L1UQmKeFsHa12Kk8d', // Breathing Club
  'spotify:track:5VIVZAQVSfJRD8f4XFbgBL', // Seven Cities Atlantis
  'spotify:track:0d4OveyI9nqkPobcPHc0M7', // Clear Blue Water
  'spotify:track:29pmOaGlEO8kRFwvFKbpTj', // Satellite Extended
  'spotify:track:2g2ObG4CPkpOSKLqffImGn', // For An Angel E-Werk
  'spotify:track:6RI2ga59q0RzaduFE2KV0N', // Gamemaster
  'spotify:track:2Ax4Brcf2qurezVv9SH0nB', // As The Rush Comes
  'spotify:track:4aiGSLfqaMW1helzbyo624', // Embrace
  'spotify:track:35uRIFbEZX8lnxRum2kw70', // Greece 2000
  'spotify:track:7ubtDZozp38SHSqUMXZvi5', // Superstring
  'spotify:track:2bG39lW9aBBSKI5eAKZRXS', // Drifting Away
  'spotify:track:2wLEdsmuvK3iHTvPjNZ5dv', // On A Good Day
  'spotify:track:77lqDkU3aO9idYFOLfQ1Ts', // Silence Tiesto
  'spotify:track:5c5ULOBXixGtK7PdMTvLVw', // Leap of Faith
  'spotify:track:3OFUHKPmHvVV2H79K10toX', // Spiritual Gateway
  'spotify:track:6zO3GdT0xUrIkOj3QaH2su', // Perception
  'spotify:track:5T0McoCHahCasRFgfXpCZk', // Serenity
  'spotify:track:6aTVxHerihREeq91z1Cb7u', // We Control The Sunlight
  'spotify:track:0ZcJZSx8cZndVwZrudIFy9', // 1998
  'spotify:track:7FlAypm5hndBIu3ILJPOYh', // Anjunabeach
];

const tr = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: CLIENT_ID,
  }),
});
const tj = await tr.json();
if (!tr.ok) {
  console.error('TOKEN', tr.status, tj);
  process.exit(1);
}
tokens.accessToken = tj.access_token;
if (tj.refresh_token) tokens.refreshToken = tj.refresh_token;
writeFileSync(TOK, JSON.stringify(tokens, null, 2));

const auth = {
  Authorization: `Bearer ${tokens.accessToken}`,
  'Content-Type': 'application/json',
};

// ADD in chunks of 10 (Spotify limit 100, but stay small)
for (let i = 0; i < uris.length; i += 10) {
  const chunk = uris.slice(i, i + 10);
  await new Promise((r) => setTimeout(r, 1500));
  const res = await fetch(`https://api.spotify.com/v1/playlists/${ABS}/items`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ uris: chunk }),
  });
  const text = await res.text();
  console.log('ADD', i, chunk.length, res.status, text.slice(0, 200));
  if (res.status === 429) {
    console.log('QUOTA_STILL');
    process.exit(2);
  }
}
console.log('DONE', uris.length);
console.log(`https://open.spotify.com/playlist/${ABS}`);
