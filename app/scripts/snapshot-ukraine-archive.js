/**
 * Appends a weekly snapshot to the Ukraine timeline archive.
 * Reads from app/static/data/ukraine.json (already preprocessed by preprocess-ukraine.js)
 * and writes a dated GeoJSON to app/static/data/ukraine-archive/YYYY-MM-DD.geojson,
 * then updates manifest.json.
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

// Layers to include in the archive (subset of what preprocess-ukraine produces)
const ARCHIVE_LAYERS = [
  { id: 'control_map',              label: 'Territoires contrôlés par la Russie',       color: '#b91c1c', fillColor: '#b91c1c', fillOpacity: 0.15 },
  { id: 'russian_advances',         label: 'Avancées russes',                            color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.3  },
  { id: 'counteroffensives',        label: 'Contre-offensives ukrainiennes',             color: '#facc15', fillColor: '#facc15', fillOpacity: 0.25 },
  { id: 'kursk_russian_advances',   label: 'Incursion de Koursk – Avancées russes',     color: '#7f1d1d', fillColor: '#7f1d1d', fillOpacity: 0.35, optional: true },
  { id: 'kursk_russian_claims',     label: 'Incursion de Koursk – Revendications russes', color: '#991b1b', fillColor: '#991b1b', fillOpacity: 0.2, optional: true },
  { id: 'kursk_ukrainian_advances', label: 'Incursion de Koursk – Avancées ukrainiennes', color: '#ca8a04', fillColor: '#ca8a04', fillOpacity: 0.35, optional: true },
];

// Determine snapshot date
const dateArgIndex = process.argv.indexOf('--date');
const dateArg = process.argv.find(a => a.startsWith('--date='))?.slice(7)
  || (dateArgIndex !== -1 ? process.argv[dateArgIndex + 1] : null);
const today = dateArg || new Date().toISOString().slice(0, 10);

// Validate date format
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`Invalid date: ${today}`);
  process.exit(1);
}

const outPath = join(ARCHIVE_DIR, `${today}.geojson`);

if (existsSync(outPath)) {
  console.log(`Snapshot already exists for ${today}, skipping.`);
} else {
  const ukraine = JSON.parse(readFileSync(UKRAINE_JSON, 'utf-8'));

  // Collect features for archive layers that are present in the data
  const archiveLayerIds = new Set(ARCHIVE_LAYERS.map(l => l.id));
  const features = ukraine.features.filter(f => archiveLayerIds.has(f.properties?.layer));

  const geojson = { type: 'FeatureCollection', features };
  writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`Snapshot written: ${today}.geojson (${features.length} features)`);
}

// Update manifest — merge existing dates with new one, keep sorted, deduplicate
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

if (!manifest.dates.includes(today)) {
  manifest.dates = [...manifest.dates, today].sort();
}

// Update layer definitions to reflect current archive layers
// Only include layers that appear in at least one archive entry
const presentLayerIds = new Set();
const snapshot = JSON.parse(readFileSync(outPath, 'utf-8'));
for (const f of snapshot.features) {
  if (f.properties?.layer) presentLayerIds.add(f.properties.layer);
}

// Keep existing layers from Le Monde era + add new ISW layers that are present
const existingIds = new Set(manifest.layers.map(l => l.id));
for (const layerDef of ARCHIVE_LAYERS) {
  if (!existingIds.has(layerDef.id) && presentLayerIds.has(layerDef.id)) {
    manifest.layers.push({ id: layerDef.id, label: layerDef.label, color: layerDef.color, fillColor: layerDef.fillColor, fillOpacity: layerDef.fillOpacity });
    existingIds.add(layerDef.id);
  }
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest));
console.log(`Manifest updated: ${manifest.dates.length} dates, ${manifest.layers.length} layers`);
