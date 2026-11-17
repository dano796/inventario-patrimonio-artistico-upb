// Genera public/mapa/bloques-upb.json (los edificios de la UPB con número de bloque) a partir de un volcado
// de Overpass (OpenStreetMap, licencia ODbL). El mapa base lo pone CARTO; este archivo solo dice qué edificio es cada bloque.
// Uso: node scripts/generar-mapa-campus.js edificios.json
// Consulta, con la caja 6.2370,-75.5960,6.2470,-75.5830: way/relation["building"], out geom
const fs = require('node:fs');
const path = require('node:path');

const [archivo] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: node scripts/generar-mapa-campus.js edificios.json');
  process.exit(1);
}

const redondear = (p) => [Math.round(p.lon * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6];

function poligonosDe(elemento) {
  if (elemento.type === 'way') return [[elemento.geometry.map(redondear)]];
  const miembros = (elemento.members || []).filter((m) => m.geometry);
  const exteriores = miembros.filter((m) => m.role === 'outer').map((m) => m.geometry.map(redondear));
  const interiores = miembros.filter((m) => m.role === 'inner').map((m) => m.geometry.map(redondear));
  return exteriores.length === 1 ? [[exteriores[0], ...interiores]] : exteriores.map((exterior) => [exterior]);
}

/**
 * El mapa base trae los mismos edificios: con la misma huella, las paredes de los dos parpadean (z-fighting).
 * Se ensancha cada polígono medio metro para que las del bloque tapen a las del mapa base.
 */
const ENSANCHE_M = 0.5;

function areaConSigno(anillo) {
  let a = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) a += anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
  return a / 2;
}

function desplazar(anillo, metros, haciaFuera) {
  const lat = anillo[0][1];
  const mx = 111320 * Math.cos((lat * Math.PI) / 180);
  const my = 110574;
  const puntos = anillo.slice(0, -1).map(([lon, lat]) => [lon * mx, lat * my]);
  const sentido = (areaConSigno(puntos) > 0 ? 1 : -1) * (haciaFuera ? 1 : -1);
  const n = puntos.length;
  const normal = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [(sentido * dy) / l, (-sentido * dx) / l];
  };
  const salida = puntos.map((p, i) => {
    const n1 = normal(puntos[(i - 1 + n) % n], p);
    const n2 = normal(p, puntos[(i + 1) % n]);
    const bx = n1[0] + n2[0];
    const by = n1[1] + n2[1];
    const coseno = Math.max(0.35, (bx * n1[0] + by * n1[1]) / (Math.hypot(bx, by) || 1));
    const l = Math.hypot(bx, by) || 1;
    return [p[0] + ((bx / l) * metros) / coseno, p[1] + ((by / l) * metros) / coseno];
  });
  salida.push(salida[0]);
  return salida.map(([x, y]) => [Math.round((x / mx) * 1e7) / 1e7, Math.round((y / my) * 1e7) / 1e7]);
}

function bloqueDe(tags) {
  const nombre = tags.name || '';
  const numero = nombre.match(/^Bloque (\d+)\b/);
  if (numero) return Number(numero[1]);
  if (/^Templo Universitario/.test(nombre)) return 1;
  if (/^Biblioteca Central/.test(nombre)) return 15;
  if (/^Colegio Universidad/.test(nombre)) return 4;
  return null;
}

const features = [];
for (const e of JSON.parse(fs.readFileSync(archivo, 'utf8')).elements) {
  const bloque = e.tags?.building ? bloqueDe(e.tags) : null;
  if (bloque === null) continue;
  const pisos = Number(e.tags['building:levels']) || null;
  for (const anillos of poligonosDe(e)) {
    const ensanchados = anillos.map((anillo, i) => desplazar(anillo, ENSANCHE_M, i === 0));
    features.push({ type: 'Feature', properties: { bloque, pisos }, geometry: { type: 'Polygon', coordinates: ensanchados } });
  }
}

const salida = path.join(__dirname, '..', 'public', 'mapa', 'bloques-upb.json');
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ type: 'FeatureCollection', atribucion: '© OpenStreetMap contributors (ODbL)', features }));
console.log(`${features.length} edificios, ${(fs.statSync(salida).size / 1024).toFixed(1)} KB`);
console.log('Bloques:', [...new Set(features.map((f) => f.properties.bloque))].sort((a, b) => a - b).join(', '));
