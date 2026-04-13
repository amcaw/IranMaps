/**
 * Converts shapefile zips to GeoJSON.
 * Handles both middle-east and ukraine data directories.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import shp from 'shpjs';

const REGIONS = ['middle-east', 'ukraine'];
const DATA_ROOT = join(import.meta.dirname, '../../data');

for (const region of REGIONS) {
  const zipsDir = join(DATA_ROOT, region, 'zips');
  const geojsonDir = join(DATA_ROOT, region, 'geojson');

  if (!existsSync(zipsDir)) continue;
  if (!existsSync(geojsonDir)) mkdirSync(geojsonDir, { recursive: true });

  const zipFiles = readdirSync(zipsDir).filter(f => f.endsWith('.zip'));
  if (zipFiles.length === 0) continue;

  console.log(`\n[${region}] Converting ${zipFiles.length} shapefiles...`);

  for (const zipFile of zipFiles) {
    const name = basename(zipFile, '.zip');
    const outPath = join(geojsonDir, `${name}.geojson`);

    const buffer = readFileSync(join(zipsDir, zipFile));
    const geojson = await shp(buffer);

    const fc = Array.isArray(geojson) ? geojson[0] : geojson;

    writeFileSync(outPath, JSON.stringify(fc));
    console.log(`  Converted: ${name}.geojson (${fc.features.length} features)`);
  }
}
