/**
 * Converts Ukraine archive TopoJSON → GeoJSON and copies to static/data/ukraine-archive/.
 * Generates a manifest of available dates.
 *
 * Output per date: one combined GeoJSON with all layers merged,
 * each feature tagged with a `layer` property.
 */

import { readdirSync, readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { feature } from 'topojson-client';

const ARCHIVE_DIR = join(import.meta.dirname, '../../data/ukraine/archive');
const OUT_DIR = join(import.meta.dirname, '../static/data/ukraine-archive');

const LAYER_COLORS = {
  control_map: { id: 'control_map', label: 'Territoires contrôlés par la Russie', color: '#b91c1c', fillColor: '#b91c1c', fillOpacity: 0.15 },
  russian_advances: { id: 'russian_advances', label: 'Avancées russes', color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.3 },
  kursk_ukrainian_advance: { id: 'kursk_ukrainian_advance', label: 'Avancée ukrainienne (Koursk)', color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.3 },
};

if (!existsSync(ARCHIVE_DIR)) {
  console.log('No archive data found. Run download-ukraine-archive.js first.');
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const dates = readdirSync(ARCHIVE_DIR)
  .filter(d => statSync(join(ARCHIVE_DIR, d)).isDirectory())
  .sort();

console.log(`Processing ${dates.length} archive dates...`);

const manifest = [];

function roundCoord(c) {
  return [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];
}

function roundGeometry(geom) {
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(ring => ring.map(roundCoord)) };
  }
  if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(roundCoord))) };
  }
  return geom;
}

let totalSize = 0;

for (const dateStr of dates) {
  const srcDir = join(ARCHIVE_DIR, dateStr);
  const outPath = join(OUT_DIR, `${dateStr}.geojson`);

  // Skip if already converted
  if (existsSync(outPath)) {
    manifest.push(dateStr);
    continue;
  }

  const files = readdirSync(srcDir).filter(f => f.endsWith('.topojson'));
  const allFeatures = [];

  for (const file of files) {
    const layerName = file.replace('.topojson', '');
    const topo = JSON.parse(readFileSync(join(srcDir, file), 'utf-8'));

    for (const objName of Object.keys(topo.objects)) {
      const fc = feature(topo, topo.objects[objName]);
      for (const f of fc.features) {
        if (!f.geometry) continue;
        allFeatures.push({
          type: 'Feature',
          geometry: roundGeometry(f.geometry),
          properties: { layer: layerName }
        });
      }
    }
  }

  const geojson = { type: 'FeatureCollection', features: allFeatures };
  const json = JSON.stringify(geojson);
  writeFileSync(outPath, json);
  totalSize += json.length;
  manifest.push(dateStr);
}

const manifestData = {
  dates: manifest,
  layers: Object.values(LAYER_COLORS),
};
const manifestPath = join(OUT_DIR, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifestData));
console.log(`Written: ${manifest.length} GeoJSON files + manifest`);
console.log(`Total size: ${Math.round(totalSize / 1024)} KB`);
