import { strFromU8, unzipSync } from 'fflate';

export interface XmlParser {
  parseFromString(xml: string, tipo: string): Document;
}

export type Celda =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'numero'; valor: number }
  | { tipo: 'formula'; formula: string; valor: string | number | null }
  | { tipo: 'imagen'; archivo: string | null }
  | { tipo: 'error'; valor: string };

export interface Hoja {
  celdas: Map<string, Celda>;
  combinadas: string[];
}

export class ErrorXlsx extends Error {}

type Lector = (ruta: string) => Document | null;

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MEDIOS = 'xl/media/';

export function descomprimirXlsx(datos: Uint8Array, incluirMedios = false): Record<string, Uint8Array> {
  return unzipSync(datos, {
    filter: (archivo) => incluirMedios || !archivo.name.startsWith(MEDIOS),
  });
}

export function tamanosDeMedios(datos: Uint8Array): Record<string, number> {
  const tamanos: Record<string, number> = {};
  unzipSync(datos, {
    filter: (archivo) => {
      if (archivo.name.startsWith(MEDIOS)) tamanos[archivo.name] = archivo.originalSize;
      return false;
    },
  });
  return tamanos;
}

export function abrirXlsx(datos: Uint8Array): { archivos: Record<string, Uint8Array>; tamanos: Record<string, number> } {
  const tamanos: Record<string, number> = {};
  const archivos = unzipSync(datos, {
    filter: (archivo) => {
      if (!archivo.name.startsWith(MEDIOS)) return true;
      tamanos[archivo.name] = archivo.originalSize;
      return false;
    },
  });
  return { archivos, tamanos };
}

export function extraerMedios(datos: Uint8Array, rutas: ReadonlySet<string>): Map<string, Uint8Array> {
  if (!rutas.size) return new Map();
  return new Map(Object.entries(unzipSync(datos, { filter: (archivo) => rutas.has(archivo.name) })));
}

export function leerHoja(
  archivos: Record<string, Uint8Array>,
  nombreHoja: string,
  parser: XmlParser
): Hoja {
  const leer: Lector = (ruta) => {
    const datos = archivos[ruta];
    return datos ? parser.parseFromString(strFromU8(datos), 'application/xml') : null;
  };
  const hoja = leer(rutaDeHoja(leer, nombreHoja));
  if (!hoja) throw new ErrorXlsx(`No se encontró la pestaña "${nombreHoja}"`);

  const textos = textosCompartidos(leer('xl/sharedStrings.xml'));
  const imagenDe = mapaDeImagenes(leer);
  const celdas = new Map<string, Celda>();
  for (const c of elementos(hoja, 'c')) {
    const ref = c.getAttribute('r');
    const celda = ref ? leerCelda(c, textos, imagenDe) : null;
    if (ref && celda) celdas.set(ref, celda);
  }
  const combinadas = elementos(hoja, 'mergeCell')
    .map((m) => m.getAttribute('ref'))
    .filter((r): r is string => !!r);
  return { celdas, combinadas };
}

function elementos(raiz: Document | Element, nombre: string): Element[] {
  const nodos = raiz.getElementsByTagNameNS('*', nombre);
  const lista: Element[] = [];
  for (let i = 0; i < nodos.length; i++) {
    const nodo = nodos.item(i);
    if (nodo) lista.push(nodo);
  }
  return lista;
}

function hijo(elemento: Element, nombre: string): Element | null {
  for (let nodo = elemento.firstChild; nodo; nodo = nodo.nextSibling) {
    if (nodo.nodeType === 1 && (nodo as Element).localName === nombre) return nodo as Element;
  }
  return null;
}

function idRelacion(elemento: Element): string {
  return elemento.getAttributeNS(NS_REL, 'id') || elemento.getAttribute('r:id') || '';
}

function resolverRuta(base: string, destino: string): string {
  if (destino.startsWith('/')) return destino.slice(1);
  const partes = base.split('/').filter(Boolean);
  for (const parte of destino.split('/')) {
    if (parte === '..') partes.pop();
    else if (parte !== '.') partes.push(parte);
  }
  return partes.join('/');
}

function relaciones(doc: Document | null, base: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const r of doc ? elementos(doc, 'Relationship') : []) {
    const id = r.getAttribute('Id');
    const destino = r.getAttribute('Target');
    if (id && destino) mapa.set(id, resolverRuta(base, destino));
  }
  return mapa;
}

function rutaDeHoja(leer: Lector, nombre: string): string {
  const libro = leer('xl/workbook.xml');
  if (!libro) throw new ErrorXlsx('El archivo no es un libro de Excel');
  const hoja = elementos(libro, 'sheet').find((s) => s.getAttribute('name') === nombre);
  if (!hoja) throw new ErrorXlsx(`No se encontró la pestaña "${nombre}"`);
  const ruta = relaciones(leer('xl/_rels/workbook.xml.rels'), 'xl').get(idRelacion(hoja));
  if (!ruta) throw new ErrorXlsx(`La pestaña "${nombre}" no tiene hoja asociada`);
  return ruta;
}

function textosCompartidos(doc: Document | null): string[] {
  if (!doc) return [];
  return elementos(doc, 'si').map((si) =>
    elementos(si, 't')
      .filter((t) => (t.parentNode as Element | null)?.localName !== 'rPh')
      .map((t) => t.textContent ?? '')
      .join('')
  );
}

function mapaDeImagenes(leer: Lector): (vm: number) => string | null {
  const metadatos = leer('xl/metadata.xml');
  const valores = leer('xl/richData/rdrichvalue.xml');
  const estructuras = leer('xl/richData/rdrichvaluestructure.xml');
  const rels = leer('xl/richData/richValueRel.xml');
  if (!metadatos || !valores || !estructuras || !rels) return () => null;

  const tipoRichValue =
    elementos(metadatos, 'metadataType').findIndex((t) => t.getAttribute('name') === 'XLRICHVALUE') + 1;
  const futuro = elementos(metadatos, 'futureMetadata').find(
    (f) => f.getAttribute('name') === 'XLRICHVALUE'
  );
  const indiceRv = futuro
    ? elementos(futuro, 'bk').map((bk) => Number(elementos(bk, 'rvb')[0]?.getAttribute('i')))
    : [];
  const metadatosValor = elementos(metadatos, 'valueMetadata')[0];
  const bloques = metadatosValor ? elementos(metadatosValor, 'bk') : [];
  const posicionClave = elementos(estructuras, 's').map((s) =>
    elementos(s, 'k').findIndex((k) => k.getAttribute('n') === '_rvRel:LocalImageIdentifier')
  );
  const rv = elementos(valores, 'rv');
  const idsRel = elementos(rels, 'rel').map(idRelacion);
  const destinos = relaciones(leer('xl/richData/_rels/richValueRel.xml.rels'), 'xl/richData');

  return (vm) => {
    const bloque = bloques[vm - 1];
    const rc = bloque ? hijo(bloque, 'rc') : null;
    if (!rc || Number(rc.getAttribute('t')) !== tipoRichValue) return null;
    const valor = rv[indiceRv[Number(rc.getAttribute('v'))]];
    if (!valor) return null;
    const posicion = posicionClave[Number(valor.getAttribute('s'))] ?? -1;
    const indiceRel = Number(elementos(valor, 'v')[posicion]?.textContent);
    return destinos.get(idsRel[indiceRel] ?? '') ?? null;
  };
}

function leerCelda(
  c: Element,
  textos: string[],
  imagenDe: (vm: number) => string | null
): Celda | null {
  const tipo = c.getAttribute('t');
  const v = hijo(c, 'v')?.textContent ?? null;
  const formula = hijo(c, 'f');
  const vm = c.getAttribute('vm');

  if (formula) {
    const valor =
      v === null
        ? null
        : tipo === 'str' || tipo === 'e'
          ? v
          : tipo === 's'
            ? textos[Number(v)] ?? ''
            : tipo === 'b'
              ? booleano(v)
              : Number(v);
    return { tipo: 'formula', formula: formula.textContent ?? '', valor };
  }
  if (vm) return { tipo: 'imagen', archivo: imagenDe(Number(vm)) };
  if (tipo === 'inlineStr') {
    return { tipo: 'texto', valor: elementos(c, 't').map((t) => t.textContent ?? '').join('') };
  }
  if (v === null) return null;
  if (tipo === 's') return { tipo: 'texto', valor: textos[Number(v)] ?? '' };
  if (tipo === 'e') return { tipo: 'error', valor: v };
  if (tipo === 'b') return { tipo: 'texto', valor: booleano(v) };
  if (tipo === 'str') return { tipo: 'texto', valor: v };
  return { tipo: 'numero', valor: Number(v) };
}

function booleano(v: string): string {
  return v === '1' ? 'true' : 'false';
}
