/**
 * Converts shapefile zips to GeoJSON.
 * Handles both middle-east and ukraine data directories.
 * Normalizes output filenames to stable names using LAYER_MAP.
 * Cleans up old/dated geojson files that don't match stable names.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync, rmSync, statSync } from 'fs';
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
  // Also match if the zip already uses a stable name
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

  // Group zips by stable name, keeping only the newest zip per name
  const newestZipPerName = {};
  for (const zipFile of zipFiles) {
    const rawName = basename(zipFile, '.zip');
    const stableName = normalizeGeoJsonName(rawName, regionMap);
    if (!stableName) {
      console.log(`  Skipped (no mapping): ${rawName}`);
      continue;
    }
    const mtime = statSync(join(zipsDir, zipFile)).mtimeMs;
    if (!newestZipPerName[stableName] || mtime > newestZipPerName[stableName].mtime) {
      newestZipPerName[stableName] = { zipFile, mtime };
    }
  }

  const stableNames = new Set(Object.keys(newestZipPerName).map(n => `${n}.geojson`));

  for (const [stableName, { zipFile, mtime: zipMtime }] of Object.entries(newestZipPerName)) {
    const outPath = join(geojsonDir, `${stableName}.geojson`);

    // Skip if geojson is newer than the newest zip
    if (existsSync(outPath)) {
      const outMtime = statSync(outPath).mtimeMs;
      if (outMtime > zipMtime) {
        console.log(`  Up to date: ${stableName}.geojson`);
        continue;
      }
    }

    const buffer = readFileSync(join(zipsDir, zipFile));
    const geojson = await shp(buffer);
    const fc = Array.isArray(geojson) ? geojson[0] : geojson;

    writeFileSync(outPath, JSON.stringify(fc));
    console.log(`  Converted: ${stableName}.geojson (${fc.features.length} features)`);
  }

  // Clean up old/dated geojson files that aren't stable names
  const existingFiles = readdirSync(geojsonDir).filter(f => f.endsWith('.geojson'));
  for (const file of existingFiles) {
    if (!stableNames.has(file)) {
      unlinkSync(join(geojsonDir, file));
      console.log(`  Removed old: ${file}`);
    }
  }

  // Clean up dated subdirectories (e.g. 2026-03-22/)
  const entries = readdirSync(geojsonDir);
  for (const entry of entries) {
    const entryPath = join(geojsonDir, entry);
    if (statSync(entryPath).isDirectory()) {
      rmSync(entryPath, { recursive: true });
      console.log(`  Removed old dir: ${entry}/`);
    }
  }
}
