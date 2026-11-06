/**
 * ADD-only Absolute jewels: deeper playlist scan + Spotify canon search.
 * Runs against Aberamentho checkout. Never PUT-wipe.
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'C:\\Users\\valen\\Aberamentho-s-Pleroma-music';
process.chdir(ROOT);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, '.env.local'));

const ABSOLUTE_ID = '7r3bXS3ov02maJKUL3h1d7';
const TOKENS_PATH = path.join(ROOT, 'data', 'spotify-tokens.json');
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? '';

const SOURCES = [
  { id: '5IiquGZEbovPj9B8IdG0bi', name: 'Perfect Music', maxScan: 3500 },
  { id: '2fTZFN3VN7HJpGJ3o8cvYz', name: 'Definitive', maxScan: 3500 },
  { id: '5Crc5YiubNahu5DIOcnlx4', name: 'Solar', maxScan: 2200 },
];

const VESSEL =
  /chicane|gouryella|system\s*f|ferry\s*corsten|rank\s*1|veracocha|age\s*of\s*love|jam\s*&\s*spoon|markus\s*schulz|dakota\b|armin(\s*van\s*buuren)?|rising\s*star|solarstone|thrillseekers|aly\s*&\s*fila|pulser|oceanlab|above\s*&\s*beyond|binary\s*finary|push\b|paul\s*van\s*dyk|cygnus\s*x|agnelli|nelson|lost\s*tribe|airwave|three\s*drives|energy\s*52|nalin|vincent\s*de\s*moor|lange\b|svenson|gielen|jones\s*&\s*stephenson|ralph\s*fridge|fire\s*&\s*ice|matt\s*darey|motorcycle|chakra|york\b|saltwater|alphazone|lustral|john\s*o'?callaghan|giuseppe\s*ottaviani|andrew\s*rayel|rapid\s*eye|schiller|william\s*orbit|atlantis|avatar|miriam\s*stockley|nifra|justine\s*suissa|audrey\s*gallagher|maria\s*nayler|starchaser|solid\s*sessions|paul\s*oakenfold|cosmic\s*gate|gareth\s*emery|gabriel\s*&\s*dresden|super8|tab\b|andy\s*moor|orkidea|andain|emma\s*hewitt|susana|jan\s*johnston|jes\b|christina\s*novelli|maarten\s*de\s*jong|ronski\s*speed|daniel\s*kandi|ashley\s*wallbridge|photographer|temple\s*one|everlight|allan\s*watts|heatbeat|sean\s*tyas|bryan\s*kearney|mark\s*sherry|protoculture|ram\b|jose\s*amnesia|miro\b|bt\b|hybrid|way\s*out\s*west|sasha\b|ornery|sunrise|ti[eë]sto|atb\b|robert\s*miles|enigma|dead\s*can\s*dance|solar\s*fields|aes\s*dana|bluetech|carbon\s*based|lowland|pink\s*bomb|aureus|jwaydan|marcella\s*woods/i;

const LOGOS =
  /christ|cristo|gnos|samael|logos|pleroma|sophia|light|luz|angel|heaven|cielo|divine|spirit|soul|alma|prayer|bless|temple|sanctuary|sacred|holy|eternal|etern|infinity|ascension|awakening|rebirth|resurrection|nirvana|lotus|solar|sunrise|sunset|moon|star|estrella|cosmos|cosmic|galaxy|oracle|creation|genesis|perception|serenity|communication|breath|airwave|saltwater|offshore|clear\s*blue|love\s*will|religion|adagio|embrace|walhalla|tenshi|ligaya|solstice|sublime|carte\s*blanche|blue\s*fear|children|greece|caf[eé]|superstring|satellite|drifting|listening|leben|circa|legacy|fiji|seven\s*cities|synaesthesia|universal\s*nation|out\s*of\s*the\s*blue|find\s*yourself|beautiful|sirens|anjuna|flowtation|fly\s*away|holding\s*on|made\s*of\s*love|eye\s*of\s*horus|3rd\s*earth|horus|isis|alchemy|phoenix|grace|peace|unity|truth|wisdom|illumin|aura|flame|silence|void|mantra|shanti|satori|samadhi|kundalini|chakra|transmission|warrior|north\s*star|my\s*religion|for\s*an\s*angel|age\s*of\s*love|everytime|reachers|gamemaster|first\s*rebirth|symfo|solarcoaster|indica|glowing|skies|burned\s*with\s*desire|control\s*the\s*sunlight|alone\s*tonight|thing\s*called\s*love|autumn\s*tactics|no\s*ordinary|pure\b|radiant|miracle|salvation|redemption|messiah|frequency|432|528|sunlight|desire|infinity|infinite|blessed|spirit\s*of|machine\s*of|transformation|distant|shores|sanctuary|anointed|halo|lotus|om\b/i;

const REJECT =
  /megamix|bootleg|mash.?up|podcast|continuous\s*mix|year\s*mix|top\s*40|tiktok|sped\s*up|nightcore|hardstyle|rawstyle|frenchcore|terror|big\s*room|djs\s*from\s*mars|switch\s*disco/i;

const CANON_QUERIES = [
  'Gouryella Ligaya Extended',
  'System F Cry Extended',
  'Ferry Corsten Galaxia',
  'Chicane Saltwater Extended',
  'Chicane Autumn Tactics Thrillseekers',
  'OceanLab Clear Blue Water Original',
  'OceanLab Beautiful Together Above Beyond',
  'OceanLab Sirens of the Sea',
  'Above Beyond Anjunabeach Extended',
  'Above Beyond Thing Called Love',
  'Rank 1 Symsonic Extended',
  'Rank 1 L.E.D. There Be Light Extended',
  'Solarstone Seven Cities Atlantis',
  'Solarstone Solarcoaster',
  'Aly Fila Listening Extended',
  'Aly Fila We Control The Sunlight',
  'Armin Burned With Desire Rising Star',
  'Armin Serenity Extended Jan Vayne',
  'Markus Schulz Distant Shores',
  'Markus Schulz The Spirit of the Warrior',
  'Gabriel Dresden Tracking Treasure Down',
  'Super8 Tab Helsinki Scorching Afternoon',
  'BT Flaming June',
  'Hybrid Finished Symphony',
  'Sasha Xpander',
  'Way Out West The Gift',
  'Robert Miles Children Dreamland',
  'Enigma Return to Innocence',
  'Dead Can Dance The Ubiquitous Mr Lovegrove',
  'Solar Fields Sol',
  'Aes Dana Season 5',
  'Carbon Based Lifeforms Hydroponic Garden',
  'Bluetech Sines and Singularities',
  'John OCallaghan Find Yourself',
  'Gareth Emery Sanctuary',
  'Cosmic Gate Exploration of Space',
  'Cosmic Gate The Wave',
  'Tiesto Adagio for Strings',
  'Paul van Dyk For An Angel E-Werk',
  'Binary Finary 1999',
  'Push Strange World',
  'Lost Tribe Angel',
  'Fire Ice Forever Young',
  'Matt Darey Liberation',
  'Chakra I Am',
  'York On The Beach',
  'Lustral Everytime',
  'Nalin Kane Beachball',
  'Three Drives Greece 2000 Extended',
  'Energy 52 Cafe Del Mar Three N One Extended',
  'Cygnus X Superstring Rank 1 Extended',
  'Veracocha Carte Blanche Extended',
  'Age of Love Watch Out For Stella Extended',
  'Jam Spoon Stella',
  'Pulser My Religion Extended',
  'Vincent de Moor Fly Away Extended',
  'Lange Drifting Away Original',
  'Motorcycle As The Rush Comes Original',
  'Agnelli Nelson Embrace Extended',
  'Agnelli Nelson Everyday Extended',
  'Thrillseekers Synaesthesia En-Motion',
  'William Orbit Barber Adagio Ferry',
  'Atlantis Fiji Lange',
  'Schiller Leben Aly Fila',
  'Rapid Eye Circa Forever Schulz',
  'Andrew Rayel Find Your Harmony',
  'Ottaviani Linking People',
  'Orkidea Unity Solarstone',
  'Andain Summer Calling Airwave',
  'Emma Hewitt Colours',
  'Susana Unbreakable',
  'Jan Johnston Flesh',
  'Jes Imagination',
];

async function refreshToken(tokens) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokens.accessToken = data.access_token;
  if (data.refresh_token) tokens.refreshToken = data.refresh_token;
  tokens.expiresAt = Date.now() + data.expires_in * 1000;
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  return tokens.accessToken;
}

async function api(token, pathName, init = {}) {
  const res = await fetch(`https://api.spotify.com/v1${pathName}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathName} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function getPlaylistTracks(token, playlistId) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`items ${res.status}`);
    for (const row of data.items || []) {
      const t = row.item || row.track;
      if (!t?.id || !t.uri || !t.name) continue;
      if (t.type && t.type !== 'track') continue;
      tracks.push({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name).join(', '),
      });
    }
    url = data.next;
  }
  return tracks;
}

async function scanSource(token, src) {
  const out = [];
  let url = `https://api.spotify.com/v1/playlists/${src.id}/items?limit=50`;
  while (url && out.length < src.maxScan) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) break;
    for (const row of data.items || []) {
      const t = row.item || row.track;
      if (!t?.id || !t.uri || !t.name) continue;
      if (t.type && t.type !== 'track') continue;
      out.push({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name).join(', '),
        source: src.name,
      });
      if (out.length >= src.maxScan) break;
    }
    url = data.next;
    await new Promise((r) => setTimeout(r, 30));
  }
  return out;
}

function scoreJewel(name, artists) {
  if (REJECT.test(name) || REJECT.test(artists)) return 0;
  const vessel = VESSEL.test(`${name} ${artists}`);
  const logos = LOGOS.test(name);
  if (!vessel || !logos) return 0;
  let score = 9;
  if (/extended|original|club mix|pure mix|classic|remaster|atlantis|e-werk/i.test(name)) score += 2;
  if (/radio edit|radio mix|\[mixed\]|\(mixed\)|edit\)/i.test(name)) score -= 3;
  return score >= 9 ? score : 0;
}

async function main() {
  if (!CLIENT_ID) throw new Error('SPOTIFY_CLIENT_ID missing');
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  const token = await refreshToken(tokens);

  const absolute = await getPlaylistTracks(token, ABSOLUTE_ID);
  writeFileSync(
    path.join(ROOT, 'data', `absolute-backup-jewels-${Date.now()}.json`),
    JSON.stringify({ count: absolute.length, tracks: absolute, at: new Date().toISOString() }, null, 2),
  );
  console.log('Absolute:', absolute.length);
  const have = new Set(absolute.map((t) => t.id));

  const candidates = [];
  for (const src of SOURCES) {
    console.log('Scanning', src.name, 'max', src.maxScan);
    const items = await scanSource(token, src);
    let n = 0;
    for (const t of items) {
      if (have.has(t.id)) continue;
      const score = scoreJewel(t.name, t.artists);
      if (!score) continue;
      candidates.push({ ...t, score });
      n += 1;
    }
    console.log(' ', items.length, 'scanned →', n, 'jewels');
  }

  for (const q of CANON_QUERIES) {
    try {
      const data = await api(token, `/search?${new URLSearchParams({ q, type: 'track', limit: '5' })}`);
      const hits = data?.tracks?.items || [];
      const best =
        hits.find((h) => scoreJewel(h.name, (h.artists || []).map((a) => a.name).join(', ')) > 0) || hits[0];
      if (!best || have.has(best.id)) continue;
      const artists = (best.artists || []).map((a) => a.name).join(', ');
      const score = scoreJewel(best.name, artists);
      if (!score) continue;
      candidates.push({
        id: best.id,
        uri: best.uri,
        name: best.name,
        artists,
        source: `spotify:${q}`,
        score: score + 1,
      });
      console.log('+', q, '→', best.name);
    } catch (e) {
      console.log('search fail', q, e.message?.slice(0, 60));
    }
    await new Promise((r) => setTimeout(r, 70));
  }

  candidates.sort((a, b) => b.score - a.score);
  const byNorm = new Map();
  for (const c of candidates) {
    if (have.has(c.id)) continue;
    const norm = `${c.name.toLowerCase().replace(/\s*-\s*.*$/, '').replace(/\[.*?\]/g, '').trim()}|${c.artists.toLowerCase().split(',')[0]?.trim()}`;
    const prev = byNorm.get(norm);
    if (!prev || c.score > prev.score) byNorm.set(norm, c);
  }

  const selected = [...byNorm.values()].sort((a, b) => b.score - a.score).slice(0, 70);
  console.log('\nJEWELS ADD', selected.length);
  for (const [i, t] of selected.entries()) {
    console.log(`${i + 1}. [${t.score}] ${t.name} — ${t.artists} (${t.source})`);
  }
  if (!selected.length) return;

  const uris = selected.map((t) => t.uri);
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await api(token, `/playlists/${ABSOLUTE_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: chunk }),
    });
    console.log('ADD chunk', chunk.length);
  }

  const live = await getPlaylistTracks(token, ABSOLUTE_ID);
  writeFileSync(
    path.join(ROOT, 'data', 'absolute-jewels-add.json'),
    JSON.stringify({ added: selected.length, total: live.length, selected, at: new Date().toISOString() }, null, 2),
  );
  console.log(`\nOK Absolute ${absolute.length} → ${live.length} (+${selected.length})`);
  console.log(`https://open.spotify.com/playlist/${ABSOLUTE_ID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
