import { Diff, Lado } from '../nucleo/diff-tipos';
import { claveImagen } from '../nucleo/foto';
import { claveCampo, claveCargo, DecisionImagen } from '../nucleo/plan-ejecucion';
import { borrarSesion, guardarSesion, leerSesion } from '../../../shared/utils/almacen';
import { estadoInicial, EstadoRevision } from './revision';

export const CLAVE_BORRADOR = 'sincronizacion-borrador';

/** d: cambio desmarcado · c: conflicto · g: cargo · i: imagen · ab: alta en la base · ah: alta en la hoja ignorada */
type Tipo = 'd' | 'c' | 'g' | 'i' | 'ab' | 'ah';
type Entrada = [tipo: Tipo, clave: string, valor: string | number | null, huella: string];

interface Borrador {
  itemId: string;
  entradas: Entrada[];
}

interface Elemento {
  clave: string;
  huella: string;
  opciones?: (string | null)[];
}

/** FNV-1a de 32 bits: basta para detectar cambios y no deja leer los valores restringidos. */
export function huella(valor: unknown): string {
  let h = 0x811c9dc5;
  for (const caracter of JSON.stringify(valor) ?? '') {
    h ^= caracter.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function elementos(diff: Diff): Map<string, Elemento> {
  const mapa = new Map<string, Elemento>();
  const anadir = (tipo: Tipo, clave: string, valores: unknown, opciones?: (string | null)[]) =>
    mapa.set(`${tipo}:${huella(clave)}`, { clave, huella: huella(valores), opciones });
  for (const c of diff.cambios) anadir('d', claveCampo(c.obraId, c.campo), [c.hoja, c.base, c.destino]);
  for (const c of diff.cargos) anadir('d', claveCargo(c.clave), [c.hoja, c.base, c.destino]);
  for (const i of diff.imagenes) anadir('d', claveCampo(i.obraId, claveImagen(i.casilla)), [i.accion, i.imagen?.id ?? null, i.leida]);
  for (const c of diff.conflictos) anadir('c', claveCampo(c.obraId, c.campo), [c.hoja, c.base]);
  for (const c of diff.conflictosCargo) anadir('g', c.clave, [c.opciones, c.base], c.opciones);
  for (const a of diff.avisosImagen) anadir('i', claveCampo(a.obraId, claveImagen(a.casilla)), [a.motivo, a.imagen?.id ?? null, a.leida]);
  for (const a of diff.altasBase) anadir('ab', String(a.fila), [a.campos, a.imagenes, a.imagenesRechazadas]);
  for (const a of diff.altasHoja) anadir('ah', String(a.obraId), a.obraId);
  return mapa;
}

export function guardarBorrador(itemId: string, diff: Diff, estado: EstadoRevision): void {
  const enDiff = elementos(diff);
  const entradas: Entrada[] = [];
  const anadir = (tipo: Tipo, clave: string, valor: string | number | null) => {
    const id = `${tipo}:${huella(clave)}`;
    const elemento = enDiff.get(id);
    if (elemento) entradas.push([tipo, huella(clave), valor, elemento.huella]);
  };
  for (const clave of estado.descartados) anadir('d', clave, null);
  for (const [clave, lado] of estado.conflictos) anadir('c', clave, lado);
  for (const [clave, cargo] of estado.conflictosCargo) {
    anadir('g', clave, enDiff.get(`g:${huella(clave)}`)?.opciones?.indexOf(cargo) ?? -1);
  }
  for (const [clave, decision] of estado.avisosImagen) anadir('i', clave, decision);
  for (const [fila, crear] of estado.altasBase) anadir('ab', String(fila), crear ? 1 : 0);
  for (const obraId of estado.altasHojaIgnoradas) anadir('ah', String(obraId), null);
  const borrador: Borrador = { itemId, entradas };
  guardarSesion(CLAVE_BORRADOR, JSON.stringify(borrador));
}

export function restaurarBorrador(
  itemId: string, diff: Diff
): { estado: EstadoRevision; recuperadas: number; total: number } | null {
  const borrador = leer();
  if (!borrador || borrador.itemId !== itemId) return null;
  const enDiff = elementos(diff);
  const inicial = estadoInicial();
  const descartados = new Set<string>();
  const conflictos = new Map<string, Lado>();
  const conflictosCargo = new Map<string, string | null>();
  const avisosImagen = new Map<string, DecisionImagen>();
  const altasBase = new Map<number, boolean>();
  const altasHojaIgnoradas = new Set<number>();
  let recuperadas = 0;
  for (const [tipo, clave, valor, guardada] of borrador.entradas) {
    const elemento = enDiff.get(`${tipo}:${clave}`);
    if (!elemento || elemento.huella !== guardada) continue;
    if (tipo === 'g' && (typeof valor !== 'number' || !elemento.opciones || valor < 0 || valor >= elemento.opciones.length)) continue;
    recuperadas++;
    if (tipo === 'd') descartados.add(elemento.clave);
    else if (tipo === 'c') conflictos.set(elemento.clave, valor as Lado);
    else if (tipo === 'g') conflictosCargo.set(elemento.clave, elemento.opciones![valor as number]);
    else if (tipo === 'i') avisosImagen.set(elemento.clave, valor as DecisionImagen);
    else if (tipo === 'ab') altasBase.set(Number(elemento.clave), valor === 1);
    else altasHojaIgnoradas.add(Number(elemento.clave));
  }
  return {
    estado: { ...inicial, descartados, conflictos, conflictosCargo, avisosImagen, altasBase, altasHojaIgnoradas },
    recuperadas,
    total: borrador.entradas.length,
  };
}

export function borrarBorrador(): void {
  borrarSesion(CLAVE_BORRADOR);
}

function leer(): Borrador | null {
  try {
    const borrador = JSON.parse(leerSesion(CLAVE_BORRADOR) ?? 'null') as Borrador | null;
    return borrador && typeof borrador.itemId === 'string' && Array.isArray(borrador.entradas) ? borrador : null;
  } catch {
    return null;
  }
}
