/**
 * Absolute — ONLY maximum perfection (score >= 11 vessel+logos+extended).
 * ADD-only. Never PUT-wipe. Clear Blue Schulz always preferred.
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
  { id: '5IiquGZEbovPj9B8IdG0bi', name: 'Perfect Music', maxScan: 4500 },
  { id: '2fTZFN3VN7HJpGJ3o8cvYz', name: 'Definitive', maxScan: 4500 },
  { id: '5Crc5YiubNahu5DIOcnlx4', name: 'Solar', maxScan: 2800 },
];

const VESSEL =
  /chicane|gouryella|system\s*f|ferry\s*corsten|rank\s*1|veracocha|age\s*of\s*love|jam\s*&\s*spoon|markus\s*schulz|dakota\b|elevation\b|armin(\s*van\s*buuren)?|rising\s*star|solarstone|thrillseekers|aly\s*&\s*fila|pulser|oceanlab|above\s*&\s*beyond|binary\s*finary|push\b|paul\s*van\s*dyk|cygnus\s*x|agnelli|nelson|lost\s*tribe|airwave|three\s*drives|energy\s*52|nalin|vincent\s*de\s*moor|lange\b|svenson|gielen|ralph\s*fridge|fire\s*&\s*ice|matt\s*darey|motorcycle|chakra(?!\s*i\s*am)|york\b|saltwater|alphazone|lustral|john\s*o'?callaghan|giuseppe\s*ottaviani|andrew\s*rayel|rapid\s*eye|schiller|william\s*orbit|atlantis|avatar|nifra|justine\s*suissa|audrey\s*gallagher|maria\s*nayler|starchaser|solid\s*sessions|paul\s*oakenfold|cosmic\s*gate|gareth\s*emery|gabriel\s*&\s*dresden|super8|andy\s*moor|orkidea|andain|emma\s*hewitt|susana|jan\s*johnston|maarten\s*de\s*jong|ronski\s*speed|photographer|temple\s*one|heatbeat|sean\s*tyas|bryan\s*kearney|mark\s*sherry|protoculture|ram\b|jose\s*amnesia|miro\b|bt\b|hybrid|sasha\b|ti[eë]sto|atb\b|robert\s*miles|delerium|lowland|pink\s*bomb|jwaydan|marcella|reorder|m\.i\.k\.e|plastic\s*boy|christina\s*novelli|richard\s*durand|way\s*out\s*west|bbe\b|warrior\b|quake\b|en-motion|green\s*court|disco\s*citizens|a\s*man\s*called\s*adam/i;

const LOGOS =
  /clear\s*blue|somewhere|christ|light|angel|heaven|divine|spirit|soul|prayer|temple|sanctuary|sacred|holy|eternal|etern|infinity|ascension|awakening|rebirth|resurrection|lotus|solar|sunrise|sunset|moon|star|cosmos|cosmic|galaxy|oracle|creation|genesis|perception|serenity|communication|breath|airwave|saltwater|offshore|love\s*will|religion|adagio|embrace|walhalla|tenshi|ligaya|solstice|sublime|carte\s*blanche|blue\s*fear|children|greece|caf[eé]|superstring|satellite|drifting|listening|leben|circa|legacy|fiji|seven\s*cities|synaesthesia|universal\s*nation|out\s*of\s*the\s*blue|find\s*yourself|beautiful|sirens|anjuna|flowtation|fly\s*away|holding\s*on|made\s*of\s*love|eye\s*of\s*horus|3rd\s*earth|horus|alchemy|phoenix|grace|peace|unity|truth|wisdom|illumin|aura|flame|silence|mantra|transmission|warrior|north\s*star|my\s*religion|for\s*an\s*angel|age\s*of\s*love|everytime|reachers|gamemaster|symfo|solarcoaster|indica|glowing|burned\s*with\s*desire|sunlight|alone\s*tonight|autumn\s*tactics|no\s*ordinary|pure\b|miracle|salvation|redemption|destiny|new\s*world|afterlife|gateway|spiritual|distant|shores|leap\s*of\s*faith|heart\s*of\s*stone|beyond\s*the\s*lights|concrete\s*angel|beauty\s*of\s*silence|liberation|whiteroom|guiding\s*light|light\s*up|forever|farewell|under\s*the\s*sun|shivers|far\s*from\s*in\s*love|from\s*within|one\s*man's\s*dream|signs\s*from|promised\s*land|home\b|desire|solstice|sun\s*&\s*moon|on\s*a\s*good\s*day|lonely\s*girl|air\s*i\s*breathe|strange\s*world|undo\s*the\s*silence|cosmic\s*dancer|graceful|soul\s*on\s*soul|valssi|blue\s*hour|love\s*u\s*more|feeling\s*this\s*way|other\s*shore|machine\s*of|spirit\s*of|first\s*rebirth|twisted|angel'?s\s*love/i;

const REJECT =
  /megamix|bootleg|mash.?up|podcast|continuous\s*mix|year\s*mix|tiktok|hardstyle|rawstyle|djs\s*from\s*mars|switch\s*disco|goom\s*gum|good\s*vibes\s*tribe|root\s*chakra|432hz|395hz|cleric|strathmore|live\s*from|toca'?s\s*miracle|pete\s*tong|poppy\s*baskcomb|avira|ilan\s*bluestone|kho.?mha|whitene?1se|activa|michael\s*woods|marcus\s*sch[oö]ssow|dumonde|marie\s*vaunt|claptone|genix|factor\s*b|bixx|darren\s*porter(?!\s*&)|richard\s*durand\s*remix|heatbeat\s*remix|yoji|coldware|tinlicker|achilles|pronti|hi_tack|david\s*gravell|album\s*cut|radio\s*edit|radio\s*mix|millenium|mix\s*edit|\(asot|\basot\s*\d+/i;

const CANON = [
  'Markus Schulz Somewhere Clear Blue Extended',
  'Markus Schulz Clear Blue Elevation',
  'Chicane Saltwater Original Extended',
  'Gouryella Ligaya Vocal Extended',
  'Gouryella Walhalla Extended',
  'System F Out Of The Blue Extended',
  'System F Solstice',
  'Rank 1 Airwave Original Extended',
  'Rank 1 Breathing Airwave Original Club',
  'Solarstone Seven Cities Atlantis Extended',
  'OceanLab Clear Blue Water Original',
  'OceanLab Satellite Above Beyond Extended',
  'OceanLab On A Good Day Extended',
  'Above Beyond Alone Tonight Extended',
  'Above Beyond Sun And Moon',
  'Aly Fila Listening Extended',
  'Aly Fila We Control The Sunlight Extended',
  'Armin Burned With Desire Rising Star Extended',
  'Armin Serenity Extended',
  'Armin Communication Extended',
  'Paul van Dyk For An Angel E-Werk',
  'Delerium Silence Tiesto In Search Of Sunrise',
  'Gareth Emery Concrete Angel',
  'Svenson Gielen Beauty Of Silence',
  'Andain Beautiful Things Gabriel Dresden',
  'Lost Tribe Gamemaster 1999 Extended',
  'Matt Darey Liberation Ferry Corsten',
  'Veracocha Carte Blanche Extended',
  'Age Of Love Stella Mix',
  'Binary Finary 1998 Original',
  'Push Universal Nation Real Anthem',
  'Three Drives Greece 2000 Extended',
  'Energy 52 Cafe Del Mar Three N One Extended',
  'Cygnus X Superstring Rank 1 Extended',
  'Lange Drifting Away Extended',
  'Motorcycle As The Rush Comes Original',
  'Agnelli Nelson Embrace Extended',
  'Thrillseekers Synaesthesia En-Motion Extended',
  'Ferry Corsten Barber Adagio',
  'William Orbit Barber Adagio Ferry',
  'Pulser My Religion Extended',
  'Vincent de Moor Fly Away Extended',
  'Rapid Eye Circa Forever',
  'Chicane Offshore Extended',
  'Chicane No Ordinary Morning Extended',
  'Schiller Leben Aly Fila',
  'John OCallaghan Find Yourself Sarah Howells',
  'Orkidea Unity Solarstone Pure',
  'Solarstone Leap of Faith Pure',
  'Markus Schulz The Spiritual Gateway',
  'Markus Schulz Perception Justine',
  'BT Flaming June',
  'Hybrid Finished Symphony',
  'Robert Miles Children Dream Version',
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
  if (!res.ok) throw new Error(`token ${res.status}`);
  const data = await res.json();
  tokens.accessToken = data.access_token;
  if (data.refresh_token) tokens.refreshToken = data.refresh_token;
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  return tokens.accessToken;
}

async function api(token, p, init = {}) {
  const res = await fetch(`https://api.spotify.com/v1${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${p} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
}

async function getAbsolute(token) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${ABSOLUTE_ID}/items?limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`abs ${res.status}`);
    for (const row of data.items || []) {
      const t = row.item || row.track;
      if (!t?.id || !t.uri || !t.name) continue;
      if (t.type && t.type !== 'track') continue;
      tracks.push({ id: t.id, uri: t.uri, name: t.name, artists: (t.artists || []).map((a) => a.name).join(', ') });
    }
    url = data.next;
  }
  return tracks;
}

async function scan(token, src) {
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
    await new Promise((r) => setTimeout(r, 20));
  }
  return out;
}

function scorePerf(name, artists) {
  const blob = `${name} ${artists}`;
  if (REJECT.test(blob)) return 0;
  if (!VESSEL.test(blob) || !LOGOS.test(name)) return 0;
  let s = 10;
  if (/extended|original|club mix|pure mix|classic|remaster|atlantis|e-werk|1999|1996|dream version/i.test(name)) s += 2;
  if (/clear\s*blue|somewhere/i.test(name) && /schulz|elevation|dakota/i.test(artists)) s += 15;
  if (/radio|\[mixed\]|\(mixed\)|album cut|mix edit/i.test(name)) s -= 4;
  return s >= 11 ? s : 0;
}

async function main() {
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  const token = await refreshToken(tokens);
  const absolute = await getAbsolute(token);
  writeFileSync(
    path.join(ROOT, 'data', `absolute-backup-perfection-${Date.now()}.json`),
    JSON.stringify({ count: absolute.length, at: new Date().toISOString() }, null, 2),
  );
  console.log('Absolute:', absolute.length);
  const have = new Set(absolute.map((t) => t.id));
  const candidates = [];

  for (const q of [
    'Markus Schulz Somewhere Clear Blue Extended',
    'Markus Schulz Clear Blue Elevation',
    'Somewhere Clear Blue Markus Schulz',
  ]) {
    const data = await api(token, `/search?${new URLSearchParams({ q, type: 'track', limit: '8' })}`);
    for (const h of data?.tracks?.items || []) {
      const artists = (h.artists || []).map((a) => a.name).join(', ');
      if (!/clear\s*blue|somewhere/i.test(h.name)) continue;
      if (!/schulz|elevation|dakota/i.test(artists)) continue;
      if (have.has(h.id) || candidates.some((c) => c.id === h.id)) continue;
      candidates.push({
        id: h.id,
        uri: h.uri,
        name: h.name,
        artists,
        source: 'USER_APEX:Clear Blue',
        score: 99,
      });
      console.log('CLEAR BLUE+', h.name);
    }
  }

  for (const src of SOURCES) {
    console.log('Scanning', src.name);
    const items = await scan(token, src);
    let n = 0;
    for (const t of items) {
      if (have.has(t.id)) continue;
      const s = scorePerf(t.name, t.artists);
      if (!s) continue;
      candidates.push({ ...t, score: s });
      n += 1;
    }
    console.log(' ', items.length, '→ perfection', n);
  }

  for (const q of CANON) {
    try {
      const data = await api(token, `/search?${new URLSearchParams({ q, type: 'track', limit: '5' })}`);
      for (const h of data?.tracks?.items || []) {
        const artists = (h.artists || []).map((a) => a.name).join(', ');
        const s = scorePerf(h.name, artists);
        if (!s || have.has(h.id)) continue;
        candidates.push({
          id: h.id,
          uri: h.uri,
          name: h.name,
          artists,
          source: `canon:${q}`,
          score: s + 1,
        });
        console.log('+', h.name);
        break;
      }
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  const byNorm = new Map();
  for (const c of candidates) {
    if (have.has(c.id)) continue;
    const norm = `${c.name
      .toLowerCase()
      .replace(/\s*-\s*.*$/, '')
      .replace(/\[.*?\]/g, '')
      .trim()}|${c.artists.toLowerCase().split(',')[0]?.trim()}`;
    const prev = byNorm.get(norm);
    if (!prev || c.score > prev.score) byNorm.set(norm, c);
  }

  const selected = [...byNorm.values()].sort((a, b) => b.score - a.score).slice(0, 45);
  console.log('\nPERFECTION ADD', selected.length);
  for (const [i, t] of selected.entries()) {
    console.log(`${i + 1}. [${t.score}] ${t.name} — ${t.artists}`);
  }
  if (!selected.length) {
    console.log('No new maximum-perfection tracks left in scan window.');
    return;
  }

  for (let i = 0; i < selected.length; i += 100) {
    const uris = selected.slice(i, i + 100).map((t) => t.uri);
    await api(token, `/playlists/${ABSOLUTE_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    });
  }

  const live = await getAbsolute(token);
  writeFileSync(
    path.join(ROOT, 'data', 'absolute-perfection-add.json'),
    JSON.stringify({ added: selected.length, total: live.length, selected, at: new Date().toISOString() }, null, 2),
  );
  console.log(`\nOK ${absolute.length} → ${live.length} (+${selected.length})`);
  console.log(`https://open.spotify.com/playlist/${ABSOLUTE_ID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
