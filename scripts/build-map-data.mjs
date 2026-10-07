// Genera las provincias/estados de cada país que van dentro de la app:
//   public/admin1/<PAÍS>.json  (Natural Earth, simplificado)
//
// Solo hay que ejecutarlo si se quiere regenerar los datos:
//   docker compose run --rm web sh -c "npm install && npm run map-data"

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ADMIN1_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
const ADMIN1_SIMPLIFY = '5%';
const OUT_DIR = 'public/admin1';

const source = path.join(os.tmpdir(), 'ne_10m_admin_1.geojson');
if (!fs.existsSync(source)) {
  console.log('Descargando provincias de Natural Earth…');
  const res = await fetch(ADMIN1_URL);
  if (!res.ok) throw new Error(`Descarga fallida: ${res.status}`);
  fs.writeFileSync(source, Buffer.from(await res.arrayBuffer()));
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// n: nombre (en español si existe), id: código de la provincia, x/y: punto para el pin, a: país
const props =
  "this.properties = { n: name_es || name || name_en || '', id: adm1_code, " +
  'x: Math.round(longitude * 100) / 100, y: Math.round(latitude * 100) / 100, a: adm0_a3 }';

execFileSync(
  'node_modules/.bin/mapshaper',
  [
    source,
    '-simplify', ADMIN1_SIMPLIFY, 'keep-shapes',
    '-each', props,
    '-split', 'a',
    '-o', 'format=topojson', 'singles', 'quantization=10000', OUT_DIR + '/',
  ],
  { stdio: 'inherit' },
);

const files = fs.readdirSync(OUT_DIR);
const bytes = files.reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`Provincias: ${files.length} países, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
