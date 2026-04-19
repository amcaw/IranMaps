/**
 * Converts shapefile zips to GeoJSON.
 * Each zip in data/{region}/zips/ is mapped to a stable layer name
 * and converted to data/{region}/geojson/{name}.geojson.
 *
 * The Apps Script normalizes filenames before pushing, so each
 * stable name should have exactly one zip. If multiple zips map
 * to the same name (legacy), the largest is used (cumulative data).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync, statSync, rmSync } from 'fs';
import { join, basename } from 'path';
import shp from 'shpjs';

const DATA_ROOT = join(import.meta.dirname, '../../data');

const LAYER_MAP = {
  'middle-east': {
    'usandisraelistrikesiniran': 'us_israeli_strikes_iran',
    'iranandaxisresponse': 'iran_axis_response',
    'israelistrikesinlebanon': 'israeli_strikes_lebanon',
    'usandisraelistrikesiniraq': 'us_israeli_strikes_iraq',
    'iranstrikesagainstcivilianvessels': 'iran_civilian_vessels',
    'hezbollahattacksinlebanon': 'hezbollah_lebanon',
  },
  'ukraine': {
    'ukrainecontrolmap': 'ukraine_control_map',
    'assessedrussianadvances': 'russian_advances',
    'assessedrussianinfiltration': 'russian_infiltration',
    'claimedrussianterritory': 'claimed_russian_territory',
    'claimedukrainiancounteroffensives': 'ukrainian_counteroffensives',
  },
};

function normalizeGeoJsonName(zipName, regionMap) {
  const lower = zipName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, stable] of Object.entries(regionMap)) {
    if (lower.includes(key)) return stable;
  }
  const stableValues = new Set(Object.values(regionMap));
  const cleaned = zipName.replace(/\.zip$/i, '').toLowerCase();
  if (stableValues.has(cleaned)) return cleaned;
  return null;
}

const REGIONS = ['middle-east', 'ukraine'];

for (const region of REGIONS) {
  const zipsDir = join(DATA_ROOT, region, 'zips');
  const geojsonDir = join(DATA_ROOT, region, 'geojson');
  const regionMap = LAYER_MAP[region];

  if (!existsSync(zipsDir)) continue;
  if (!existsSync(geojsonDir)) mkdirSync(geojsonDir, { recursive: true });

  const zipFiles = readdirSync(zipsDir).filter(f => f.endsWith('.zip'));
  if (zipFiles.length === 0) continue;

  console.log(`\n[${region}] Converting ${zipFiles.length} shapefiles...`);

  // Map each zip to its stable name.
  // Prefer exact stable-named zips (e.g. israeli_strikes_lebanon.zip) over
  // date-stamped variants — stable names are written by the Apps Script and
  // always reflect the latest data.
  const stableValues = new Set(Object.values(regionMap));
  const bestZipPerName = {};
  for (const zipFile of zipFiles) {
    const baseName = basename(zipFile, '.zip');
    const stableName = normalizeGeoJsonName(baseName, regionMap);
    if (!stableName) {
      console.log(`  Skipped (no mapping): ${baseName}`);
      continue;
    }
    const isStable = stableValues.has(baseName);
    const size = statSync(join(zipsDir, zipFile)).size;
    const existing = bestZipPerName[stableName];
    const existingIsStable = existing && stableValues.has(basename(existing.zipFile, '.zip'));
    // Stable beats date-stamped; among same kind, larger size wins (cumulative data)
    if (!existing || (!existingIsStable && isStable) || (existingIsStable === isStable && size > existing.size)) {
      bestZipPerName[stableName] = { zipFile, size };
    }
  }

  const stableNames = new Set(Object.keys(bestZipPerName).map(n => `${n}.geojson`));

  // Convert each layer
  for (const [stableName, { zipFile }] of Object.entries(bestZipPerName)) {
    const outPath = join(geojsonDir, `${stableName}.geojson`);
    const buffer = readFileSync(join(zipsDir, zipFile));
    const geojson = await shp(buffer);
    const fc = Array.isArray(geojson) ? geojson[0] : geojson;
    writeFileSync(outPath, JSON.stringify(fc));
    console.log(`  ${stableName}.geojson ← ${zipFile} (${fc.features.length} features)`);
  }

  // Clean up old geojson files that no longer have a matching zip
  for (const file of readdirSync(geojsonDir).filter(f => f.endsWith('.geojson'))) {
    if (!stableNames.has(file)) {
      unlinkSync(join(geojsonDir, file));
      console.log(`  Removed old: ${file}`);
    }
  }
  for (const entry of readdirSync(geojsonDir)) {
    const entryPath = join(geojsonDir, entry);
    if (statSync(entryPath).isDirectory()) {
      rmSync(entryPath, { recursive: true });
      console.log(`  Removed old dir: ${entry}/`);
    }
  }
}
