/**
 * Absolute — next solar jewel batch → clipboard (spotify:track URIs).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DATA = 'C:\\Users\\valen\\Aberamentho-s-Pleroma-music\\data';
const raw = JSON.parse(readFileSync(path.join(DATA, 'absolute-backup-jewels-1793808249610.json'), 'utf8'));
const arr = Array.isArray(raw) ? raw : raw.tracks || raw.items || raw.selected || [];

const want = [
  [/concrete angel/i, /gareth/i],
  [/beauty of silence/i, /svenson|gielen/i],
  [/gamemaster/i, /lost tribe|matt darey/i],
  [/for an angel/i, /paul van dyk|van dyk/i],
  [/as the rush comes/i, /motorcycle/i],
  [/embrace/i, /agnelli/i],
  [/greece 2000/i, /three drives/i],
  [/cafe del mar/i, /energy|three|n.?one/i],
  [/superstring/i, /cygnus|rank/i],
  [/drifting away/i, /lange/i],
  [/on a good day/i, /oceanlab|above/i],
  [/silence/i, /delerium|tiesto|tiësto/i],
  [/flaming june/i, /\bbt\b/i],
  [/finished symphony/i, /hybrid/i],
  [/leap of faith/i, /solarstone/i],
  [/spiritual gateway/i, /schulz/i],
  [/perception/i, /schulz|justine/i],
  [/airwave/i, /rank 1/i],
  [/serenity/i, /armin/i],
  [/we control the sunlight/i, /aly/i],
  [/1998/i, /binary finary/i],
  [/holding on/i, /agnelli/i],
  [/made of love/i, /above/i],
  [/northern lights/i, /above/i],
  [/anjunabeach/i, /above/i],
];

const picked = [];
const seen = new Set();

for (const [titleRe, artRe] of want) {
  let best = null;
  for (const t of arr) {
    const name = String(t.name || '');
    const art = String(t.artists || '');
    if (!titleRe.test(name)) continue;
    if (!artRe.test(`${art} ${name}`)) continue;
    if (
      /radio edit|mix edit|\(mixed\)|megamix|podcast/i.test(name) &&
      !/extended|original|club|ewerk|e-werk|1999|pure|real/i.test(name)
    ) {
      continue;
    }
    const score =
      (/extended|original|club|ewerk|1999|pure|real anthem/i.test(name) ? 3 : 0) +
      (/radio|edit|\(mixed\)/i.test(name) ? -2 : 0);
    if (!best || score > best.score) best = { t, score };
  }
  if (best && !seen.has(best.t.id)) {
    seen.add(best.t.id);
    picked.push(best.t);
  }
}

const uris = picked.map((t) => `spotify:track:${t.id}`);
const labeled = picked.map((t) => `${t.name} — ${t.artists} | spotify:track:${t.id}`);
const urisPath = path.join(DATA, 'absolute-paste-next.txt');
const listPath = path.join(DATA, 'absolute-paste-next-list.txt');
writeFileSync(urisPath, uris.join('\n'), 'utf8');
writeFileSync(listPath, labeled.join('\n'), 'utf8');

execFileSync(
  'powershell.exe',
  ['-NoProfile', '-Command', `Set-Clipboard -Value (Get-Content -Raw -LiteralPath '${urisPath}')`],
  { stdio: 'inherit' },
);

console.log(JSON.stringify({ clipboard: true, count: picked.length }, null, 2));
for (const line of labeled) console.log(line);
