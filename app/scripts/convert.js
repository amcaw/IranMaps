/**
 * Converts shapefile zips in data/zips/ to GeoJSON in data/geojson/
 * Uses shpjs (pure JS) — no GDAL needed.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import shp from 'shpjs';

const ZIPS_DIR = join(import.meta.dirname, '../../data/zips');
const GEOJSON_DIR = join(import.meta.dirname, '../../data/geojson');

if (!existsSync(GEOJSON_DIR)) mkdirSync(GEOJSON_DIR, { recursive: true });

const zipFiles = readdirSync(ZIPS_DIR).filter(f => f.endsWith('.zip'));

for (const zipFile of zipFiles) {
  const name = basename(zipFile, '.zip');
  const outPath = join(GEOJSON_DIR, `${name}.geojson`);

  const buffer = readFileSync(join(ZIPS_DIR, zipFile));
  const geojson = await shp(buffer);

  // shpjs can return an array if multiple layers; take first
  const fc = Array.isArray(geojson) ? geojson[0] : geojson;

  writeFileSync(outPath, JSON.stringify(fc));
  console.log(`Converted: ${name}.geojson (${fc.features.length} features)`);
}
