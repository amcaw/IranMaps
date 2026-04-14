/**
 * Downloads weekly snapshots of Ukraine data from Le Monde's CDN.
 * Le Monde mirrors ISW data as TopoJSON, updated weekly.
 *
 * Layers:
 *   - UkraineControlMap (medias/)
 *   - AssessedRussianAdvancesinUkraine (assets/)
 *   - Kursk_Incursion_Claimed_Limit_of_Ukrainian_Advance (medias/)
 *
 * Date range: Feb 24, 2022 → present (weekly, mostly Sundays/Saturdays)
 *
 * Outputs to data/ukraine/archive/YYYY-MM-DD/
 *   - control_map.topojson
 *   - russian_advances.topojson
 *   - kursk_ukrainian_advance.topojson
 *
 * Usage:
 *   cd app && node scripts/download-ukraine-archive.js
 *
 * Resumable — skips dates that already have all files.
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const ARCHIVE_DIR = join(import.meta.dirname, '../../data/ukraine/archive');
const BASE = 'https://assets-decodeurs.lemonde.fr/decodeurs';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:149.0) Gecko/20100101 Firefox/149.0',
  'Referer': 'https://www.lemonde.fr/international/article/2023/07/28/les-cartes-de-la-guerre-en-ukraine-depuis-l-invasion-russe-de-fevrier-2022_6118209_3213.html',
  'Origin': 'https://www.lemonde.fr',
};

const LAYERS = [
  { name: 'control_map', url: `${BASE}/medias/UkraineControlMap` },
  { name: 'russian_advances', url: `${BASE}/assets/AssessedRussianAdvancesinUkraine` },
  { name: 'kursk_ukrainian_advance', url: `${BASE}/medias/Kursk_Incursion_Claimed_Limit_of_Ukrainian_Advance` },
];

// Kursk incursion started Aug 2024
const KURSK_START = '2024-08-01';

const DELAY_MS = 500; // Le Monde CDN has no strict rate limit, but be polite

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Generate candidate dates: every day from Feb 24 2022, try to find which ones exist
// We know it's roughly weekly (Sundays/Saturdays), so we generate all possible
// weekly dates and probe them.
function generateWeeklyDates() {
  const dates = [];
  const start = new Date('2022-02-24');
  const now = new Date();

  // First date is always Feb 24
  dates.push('2022-02-24');

  // Then every 7 days, but try both Saturday and Sunday since the pattern varies
  let d = new Date('2022-02-27'); // first Sunday after invasion
  while (d <= now) {
    dates.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 7 * 86400000);
  }

  return dates;
}

async function downloadFile(url, outPath) {
  const resp = await fetch(url, { headers: HEADERS });
  if (resp.status === 200) {
    const text = await resp.text();
    writeFileSync(outPath, text);
    return true;
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────

if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

const candidates = generateWeeklyDates();
console.log(`Checking ${candidates.length} candidate dates...\n`);

let downloaded = 0;
let skipped = 0;
let notFound = 0;

for (const dateStr of candidates) {
  const dateDir = join(ARCHIVE_DIR, dateStr);

  // Skip if directory exists and has files
  if (existsSync(dateDir) && readdirSync(dateDir).length > 0) {
    skipped++;
    continue;
  }

  // Try control map first to check if date exists
  const testUrl = `${LAYERS[0].url}/${dateStr}.topojson`;
  const testResp = await fetch(testUrl, { headers: HEADERS });

  if (testResp.status !== 200) {
    notFound++;
    continue;
  }

  mkdirSync(dateDir, { recursive: true });
  process.stdout.write(`  ${dateStr}: `);

  // Save control map (already fetched)
  writeFileSync(join(dateDir, 'control_map.topojson'), await testResp.text());
  let count = 1;

  // Download remaining layers
  for (const layer of LAYERS.slice(1)) {
    // Skip Kursk before it started
    if (layer.name === 'kursk_ukrainian_advance' && dateStr < KURSK_START) continue;

    await sleep(DELAY_MS);
    const ok = await downloadFile(`${layer.url}/${dateStr}.topojson`, join(dateDir, `${layer.name}.topojson`));
    if (ok) count++;
  }

  console.log(`${count} files`);
  downloaded++;
  await sleep(DELAY_MS);
}

console.log(`\nDone. Downloaded: ${downloaded}, Skipped: ${skipped}, Not found: ${notFound}`);
console.log(`Archive: ${ARCHIVE_DIR}`);
