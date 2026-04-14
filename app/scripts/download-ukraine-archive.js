/**
 * Downloads weekly snapshots of Ukraine control-of-terrain from ISW ArcGIS.
 *
 * Source: UkrainianCoTTimelapse_FEB_2022_to_DEC_2024_view (layer 0)
 *   - 1041 daily snapshots, Feb 24 2022 → Dec 31 2024
 *   - Each feature has a `datetime` field
 *
 * Outputs one GeoJSON per week to data/ukraine/archive/YYYY-MM-DD.geojson
 *
 * Rate limit: 6000 request units/min (shared across all ISW ArcGIS users).
 * This script uses 10s delays between requests to stay well under the limit.
 * If rate-limited, it waits 90s and retries automatically.
 *
 * Usage:
 *   cd app && node scripts/download-ukraine-archive.js
 *
 * The script is resumable — it skips dates that already have a file.
 * You can interrupt and re-run safely.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ARCHIVE_DIR = join(import.meta.dirname, '../../data/ukraine/archive');
const BASE_URL = 'https://services5.arcgis.com/SaBe5HMtmnbqSWlu/arcgis/rest/services/UkrainianCoTTimelapse_FEB_2022_to_DEC_2024_view/FeatureServer/0/query';

const DELAY_MS = 10000; // 10s between requests
const RETRY_DELAY_MS = 90000; // 90s on rate limit

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function query(params, retries = 3) {
  const url = BASE_URL + '?' + new URLSearchParams({ f: 'json', ...params });
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) {
    if (data.error.code === 429 && retries > 0) {
      console.log(`  ⏳ Rate limited, waiting ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      return query(params, retries - 1);
    }
    throw new Error(JSON.stringify(data.error));
  }
  return data;
}

async function queryGeoJSON(params, retries = 3) {
  const url = BASE_URL + '?' + new URLSearchParams({ f: 'geojson', ...params });
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) {
    if (data.error.code === 429 && retries > 0) {
      console.log(`  ⏳ Rate limited, waiting ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      return queryGeoJSON(params, retries - 1);
    }
    throw new Error(JSON.stringify(data.error));
  }
  return data;
}

// ── Get all available dates ────────────────────────────────────────

console.log('Fetching available dates...');
const datesResp = await query({
  where: 'datetime IS NOT NULL',
  outFields: 'datetime',
  returnGeometry: 'false',
  returnDistinctValues: 'true',
  orderByFields: 'datetime ASC',
  resultRecordCount: '2000',
});

const allDates = datesResp.features
  .map(f => f.attributes.datetime)
  .filter(Boolean)
  .map(ts => new Date(ts).toISOString().slice(0, 10));

console.log(`Found ${allDates.length} dates (${allDates[0]} → ${allDates[allDates.length - 1]})\n`);

// ── Pick one date per week ─────────────────────────────────────────

const weeklyDates = [];
let lastPicked = null;
for (const dateStr of allDates) {
  const d = new Date(dateStr);
  if (!lastPicked || (d - lastPicked) >= 6 * 86400000) {
    weeklyDates.push(dateStr);
    lastPicked = d;
  }
}
console.log(`Selected ${weeklyDates.length} weekly snapshots\n`);

// ── Download each snapshot ─────────────────────────────────────────

if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const dateStr of weeklyDates) {
  const outPath = join(ARCHIVE_DIR, `${dateStr}.geojson`);

  if (existsSync(outPath)) {
    skipped++;
    continue;
  }

  process.stdout.write(`  ${dateStr}: `);

  try {
    const geojson = await queryGeoJSON({
      where: `datetime >= TIMESTAMP '${dateStr} 00:00:00' AND datetime < TIMESTAMP '${dateStr} 23:59:59'`,
      outFields: '*',
      outSR: '4326',
      resultRecordCount: '2000',
    });

    if (!geojson.features || geojson.features.length === 0) {
      console.log('no data');
      failed++;
    } else {
      writeFileSync(outPath, JSON.stringify(geojson));
      console.log(`${geojson.features.length} features`);
      downloaded++;
    }
  } catch (e) {
    console.log(`error: ${e.message.slice(0, 100)}`);
    failed++;
  }

  await sleep(DELAY_MS);
}

console.log(`\nDone. Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
console.log(`Archive: ${ARCHIVE_DIR}`);
