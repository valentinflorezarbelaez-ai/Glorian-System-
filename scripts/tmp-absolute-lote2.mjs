/**
 * Absolute Lote 2 — solo lo mejor (click HTML + URI list).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DATA = 'C:\\Users\\valen\\Aberamentho-s-Pleroma-music\\data';
const raw = JSON.parse(readFileSync(path.join(DATA, 'absolute-backup-jewels-1793808249610.json'), 'utf8'));
const arr = Array.isArray(raw) ? raw : raw.tracks || raw.items || raw.selected || [];

const already = new Set([
  '5UclhffLhYHkmAk7rTlxtR',
  '73gibd57cbwAPJ64KZZbfL',
  '53RvV6KioUjQuBFNLseks1',
  '1Oyf1L1UQmKeFsHa12Kk8d',
  '5VIVZAQVSfJRD8f4XFbgBL',
  '0d4OveyI9nqkPobcPHc0M7',
  '29pmOaGlEO8kRFwvFKbpTj',
  '2g2ObG4CPkpOSKLqffImGn',
  '6RI2ga59q0RzaduFE2KV0N',
  '2Ax4Brcf2qurezVv9SH0nB',
  '4aiGSLfqaMW1helzbyo624',
  '35uRIFbEZX8lnxRum2kw70',
  '7ubtDZozp38SHSqUMXZvi5',
  '2bG39lW9aBBSKI5eAKZRXS',
  '2wLEdsmuvK3iHTvPjNZ5dv',
  '77lqDkU3aO9idYFOLfQ1Ts',
  '5c5ULOBXixGtK7PdMTvLVw',
  '3OFUHKPmHvVV2H79K10toX',
  '6zO3GdT0xUrIkOj3QaH2su',
  '5T0McoCHahCasRFgfXpCZk',
  '6aTVxHerihREeq91z1Cb7u',
  '0ZcJZSx8cZndVwZrudIFy9',
  '7FlAypm5hndBIu3ILJPOYh',
]);

const want = [
  [/concrete angel/i, /gareth/i, 'Concrete Angel'],
  [/beauty of silence/i, /svenson|gielen/i, 'Beauty of Silence'],
  [/cafe del mar/i, /energy|three|n.?one/i, 'Cafe Del Mar'],
  [/flaming june/i, /\bbt\b|brian/i, 'Flaming June'],
  [/finished symphony/i, /hybrid/i, 'Finished Symphony'],
  [/saltwater/i, /chicane|maire|moya|brennan/i, 'Saltwater'],
  [/offshore/i, /chicane/i, 'Offshore'],
  [/tenshi/i, /gouryella/i, 'Tenshi'],
  [/blue fear/i, /armin/i, 'Blue Fear'],
  [/carte blanche/i, /veracocha/i, 'Carte Blanche'],
  [/age of love/i, /jam|spoon|stella|age of love/i, 'Age Of Love Stella'],
  [/my religion/i, /pulser/i, 'My Religion'],
  [/adagio/i, /ferry|orbit|barber/i, "Barber's Adagio"],
  [/leben/i, /schiller|aly/i, 'Leben I Feel You'],
  [/\bfiji\b/i, /atlantis|lange|avatar/i, 'Fiji'],
  [/3rd earth|third earth/i, /solarstone|scott bond/i, '3rd Earth'],
  [/eye of horus/i, /aly|fila/i, 'Eye Of Horus'],
  [/circa.?forever/i, /rapid|schulz|thrill/i, 'Circa Forever'],
  [/made of love/i, /above/i, 'Made Of Love'],
  [/northern lights/i, /above/i, 'Northern Lights'],
  [/liberation/i, /matt darey|ferry|fly like/i, 'Liberation'],
  [/find yourself/i, /o.?callaghan|howells/i, 'Find Yourself'],
  [/out of the blue/i, /system f/i, 'Out Of The Blue'],
  [/solstice/i, /system f/i, 'Solstice'],
  [/children/i, /robert miles/i, 'Children'],
  [/universal nation/i, /push/i, 'Universal Nation'],
  [/communication/i, /armin/i, 'Communication'],
  [/burned with desire/i, /armin|rising star/i, 'Burned With Desire'],
  [/no ordinary morning/i, /chicane/i, 'No Ordinary Morning'],
  [/alone tonight/i, /above/i, 'Alone Tonight'],
  [/listening/i, /aly|fila/i, 'Listening'],
  [/ligaya/i, /gouryella/i, 'Ligaya'],
  [/walhalla/i, /gouryella/i, 'Walhalla'],
];

const picked = [];
const seen = new Set(already);

for (const [titleRe, artRe, label] of want) {
  let best = null;
  for (const t of arr) {
    const name = String(t.name || '');
    const art = String(t.artists || '');
    if (!titleRe.test(name)) continue;
    if (!artRe.test(`${art} ${name}`)) continue;
    if (/megamix|podcast|bootleg|mash/i.test(name)) continue;
    const score =
      (/extended|original|club|pure|real anthem|atlantis|ewerk|1999/i.test(name) ? 4 : 0) +
      (/radio|edit|\(mixed\)|mix edit/i.test(name) ? -3 : 0) +
      (/yoji|gravell|hi_tack|darude|david gravell/i.test(art) ? -2 : 0);
    if (!best || score > best.score) best = { t, score, label };
  }
  if (best && !seen.has(best.t.id)) {
    seen.add(best.t.id);
    picked.push({ ...best.t, label: best.label, score: best.score });
  }
}

picked.sort((a, b) => b.score - a.score);

const links = picked
  .map(
    (t, i) =>
      `<a href="spotify:track:${t.id}">${i + 1}. ${t.label} — ${escapeHtml(t.name)} (${escapeHtml(String(t.artists || ''))})</a>`,
  )
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Absolute Lote 2 — solo lo mejor</title>
  <style>
    body { font-family: Georgia, serif; background: #0b1220; color: #e8eefc; margin: 0; padding: 2rem; }
    a { display: block; padding: .85rem 1rem; margin: .45rem 0; border: 1px solid #2a3b5c;
        border-radius: .4rem; color: #f4f7ff; text-decoration: none;
        background: linear-gradient(120deg, #132038, #1a2d4d); }
    a:hover { border-color: #7eb6ff; }
    p { color: #9db0d0; max-width: 40rem; }
  </style>
</head>
<body>
  <h1>Absolute — Lote 2 (solo lo mejor)</h1>
  <p>Clic → Spotify → ⋯ → Add to playlist → Absolute. No uses Ctrl+V.</p>
  <p><a href="spotify:playlist:7r3bXS3ov02maJKUL3h1d7" style="display:inline;border:0;background:none;color:#7eb6ff;padding:0">Abrir Absolute</a></p>
  ${links}
</body>
</html>
`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const htmlPath = path.join(DATA, 'absolute-click-add-lote2.html');
const listPath = path.join(DATA, 'absolute-paste-lote2-list.txt');
writeFileSync(htmlPath, html, 'utf8');
writeFileSync(
  listPath,
  picked.map((t) => `${t.label} | ${t.name} — ${t.artists} | spotify:track:${t.id}`).join('\n'),
  'utf8',
);

execFileSync('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${htmlPath}'`], {
  stdio: 'inherit',
});

console.log(JSON.stringify({ count: picked.length, htmlPath }, null, 2));
for (const t of picked) {
  console.log(`${t.score} | ${t.label} | ${t.name} — ${t.artists}`);
}
