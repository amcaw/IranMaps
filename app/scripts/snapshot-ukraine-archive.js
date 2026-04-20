/**
 * Appends a weekly snapshot to the Ukraine timeline archive.
 * Reads from app/static/data/ukraine.json (already preprocessed by preprocess-ukraine.js)
 * and writes a dated GeoJSON to app/static/data/ukraine-archive/YYYY-MM-DD.geojson,
 * then updates manifest.json.
 *
 * Maintains consistency with Le Monde archive layer IDs:
 *   control_map            ← control_map (same)
 *   russian_advances       ← russian_advances (same)
 *   kursk_ukrainian_advance ← kursk_ukrainian_advances (remapped, singular Le Monde ID)
 *
 * All other ISW layers (counteroffensives, kursk_russian_*) are excluded
 * so the timeline legend stays consistent across all dates.
 *
 * Run after preprocess-ukraine.js. Called weekly by the GitHub Action.
 * Pass --date YYYY-MM-DD to override today's date (for backfilling).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dirname, '../static/data');
const ARCHIVE_DIR = join(DATA_DIR, 'ukraine-archive');
const UKRAINE_JSON = join(DATA_DIR, 'ukraine.json');
const MANIFEST_PATH = join(ARCHIVE_DIR, 'manifest.json');

// Maps ISW layer IDs → Le Monde archive layer IDs.
// Only these layers are written to the archive.
const LAYER_MAP = {
  'control_map':           'control_map',
  'russian_advances':      'russian_advances',
  'kursk_ukrainian_advances': 'kursk_ukrainian_advance', // remap to Le Monde singular ID
};

// Determine snapshot date
const dateArgIndex = process.argv.indexOf('--date');
const dateArg = process.argv.find(a => a.startsWith('--date='))?.slice(7)
  || (dateArgIndex !== -1 ? process.argv[dateArgIndex + 1] : null);
const today = dateArg || new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`Invalid date: ${today}`);
  process.exit(1);
}

const outPath = join(ARCHIVE_DIR, `${today}.geojson`);

if (existsSync(outPath)) {
  console.log(`Snapshot already exists for ${today}, skipping.`);
} else {
  const ukraine = JSON.parse(readFileSync(UKRAINE_JSON, 'utf-8'));

  const features = [];
  for (const f of ukraine.features) {
    const archiveId = LAYER_MAP[f.properties?.layer];
    if (!archiveId) continue;
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: { layer: archiveId },
    });
  }

  writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`Snapshot written: ${today}.geojson (${features.length} features)`);
}

// Update manifest — merge new date, keep sorted, no layer changes (Le Monde layers are authoritative)
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

if (!manifest.dates.includes(today)) {
  manifest.dates = [...manifest.dates, today].sort();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest));
  console.log(`Manifest updated: ${manifest.dates.length} dates`);
} else {
  console.log(`Date ${today} already in manifest`);
}
