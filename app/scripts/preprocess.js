/**
 * Preprocesses GeoJSON data for the SvelteKit app.
 * - Reads from data/geojson/ (flat structure, one file per layer)
 * - Reprojects EPSG:3857 → EPSG:4326
 * - Normalizes properties, filters nulls
 * - Outputs a single JSON file for fast loading
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dirname, '../../data/geojson');
const OUT_DIR = join(import.meta.dirname, '../static/data');

const LAYERS = [
  { file: 'us_israeli_strikes_iran.geojson', id: 'strikes_iran', label: 'US & Israeli Strikes in Iran', color: '#e63946' },
  { file: 'iran_axis_response.geojson', id: 'iran_response', label: 'Iran & Axis Response', color: '#f4a261' },
  { file: 'israeli_strikes_lebanon.geojson', id: 'strikes_lebanon', label: 'Israeli Strikes in Lebanon', color: '#2a9d8f' },
  { file: 'us_israeli_strikes_iraq.geojson', id: 'strikes_iraq', label: 'US & Israeli Strikes in Iraq', color: '#e76f51' },
  { file: 'iran_civilian_vessels.geojson', id: 'civilian_vessels', label: 'Iran Strikes against Civilian Vessels', color: '#264653' },
  { file: 'hezbollah_lebanon.geojson', id: 'hezbollah_lebanon', label: 'Hezbollah Attacks in Lebanon', color: '#6a0572' },
];

function reprojectPoint(x, y) {
  const lon = (x * 180) / 20037508.34;
  const lat = (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}

function isWebMercator(coords) {
  return Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90;
}

function extractDate(props) {
  return props.strikedate || props.AssessedDa || props.event_date || props.date || props.Date || props.post_date || props.Post_Date || null;
}

function processLayer(layerDef) {
  // Try exact file name first, then scan directory for matching files
  let filePath = join(DATA_DIR, layerDef.file);

  if (!existsSync(filePath)) {
    // Scan for files matching the layer pattern
    const pattern = layerDef.file.replace('.geojson', '');
    const files = readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.geojson'))
      .filter(f => {
        const normalized = f.toLowerCase().replace(/[^a-z]/g, '');
        const target = pattern.replace(/_/g, '');
        return normalized.includes(target);
      })
      .sort();

    if (files.length === 0) {
      console.warn(`  ${layerDef.id}: no file found`);
      return [];
    }
    filePath = join(DATA_DIR, files[files.length - 1]);
  }

  console.log(`  ${layerDef.id}: ${filePath.split('/').pop()}`);
  const geojson = JSON.parse(readFileSync(filePath, 'utf-8'));
  const features = [];

  for (const feature of geojson.features) {
    if (!feature.geometry || !feature.geometry.coordinates) continue;

    const coords = feature.geometry.coordinates;
    const [lon, lat] = isWebMercator(coords) ? reprojectPoint(coords[0], coords[1]) : coords;

    if (isNaN(lon) || isNaN(lat) || (lon === 0 && lat === 0)) continue;

    const props = feature.properties || {};
    const date = extractDate(props);
    if (!date || date < '2026-01-01' || date > '2026-12-31') continue;

    features.push({
      lon, lat, date,
      layer: layerDef.id,
      city: props.city || props.City || props.location || props.Location || '',
      type: props.event_type || props.Event_Type || props.eventType1 || props.site_type || props.Site_Type_ || '',
      actor: props.actor || props.Actor || '',
    });
  }

  console.log(`    → ${features.length} features (${geojson.features.length - features.length} filtered)`);
  return features;
}

console.log('Preprocessing GeoJSON data...');

const allFeatures = [];
const layerMeta = [];

for (const layerDef of LAYERS) {
  const features = processLayer(layerDef);
  allFeatures.push(...features);
  layerMeta.push({ id: layerDef.id, label: layerDef.label, color: layerDef.color, count: features.length });
}

const dates = [...new Set(allFeatures.map(f => f.date))].sort();
console.log(`\nDate range: ${dates[0]} → ${dates[dates.length - 1]}`);
console.log(`Total features: ${allFeatures.length}`);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const output = { meta: { layers: layerMeta, dates, generated: new Date().toISOString() }, features: allFeatures };
const outPath = join(OUT_DIR, 'strikes.json');
writeFileSync(outPath, JSON.stringify(output));
console.log(`Written: ${outPath} (${Math.round(readFileSync(outPath).length / 1024)} KB)`);
