import { normalizarTexto } from './normalizacion';

export interface AsignacionIdWeb {
  fila: number;
  obraId: number;
  autor: string | null;
  titulo: string | null;
  // Opcionales para aceptar un id-web.json generado antes de que existieran.
  tecnica?: string | null;
  dimension?: string | null;
}

export interface EstadoFila {
  autor: unknown;
  titulo: unknown;
  idWeb: unknown;
  tecnica?: unknown;
  dimension?: unknown;
}

export interface Discrepancia {
  fila: number;
  motivo: string;
}

export type Verificacion =
  | { ok: true; pendientes: AsignacionIdWeb[] }
  | { ok: false; discrepancias: Discrepancia[] };

/**
 * Graph devuelve una fórmula de Excel rota (celda con imagen que ya no puede
 * evaluarse, referencia perdida, etc.) como uno de estos textos de error, no
 * como celda vacía. La copia importada, en cambio, ya leyó esa misma celda
 * como NULL (ver `leerFilasObras`): sin este tratamiento, cada fila así queda
 * en discrepancia permanente y bloquea toda la escritura.
 */
const VALORES_ERROR_EXCEL = new Set([
  '#VALUE!', '#N/A', '#REF!', '#NAME?', '#DIV/0!', '#NUM!', '#NULL!',
  '#SPILL!', '#CALC!', '#BLOCKED!', '#CONNECT!', '#FIELD!', '#UNKNOWN!', '#BUSY!',
]);

export function normalizarCeldaHoja(valor: unknown): string | null {
  if (typeof valor === 'string' && VALORES_ERROR_EXCEL.has(valor.trim().toUpperCase())) return null;
  return normalizarTexto(valor);
}

/** `undefined` en `esperado` significa «no se trajo este campo»: no se compara. */
function coincide(esperado: string | null | undefined, actual: unknown): boolean {
  return esperado === undefined || normalizarCeldaHoja(actual) === normalizarTexto(esperado);
}

/**
 * Una `fila` o un `obraId` repetidos en id-web.json escribirían dos veces la
 * misma celda o el mismo ID en dos filas: se rechaza sin tocar la hoja.
 */
export function duplicados(asignaciones: AsignacionIdWeb[]): Discrepancia[] {
  const discrepancias: Discrepancia[] = [];

  const vecesPorFila = new Map<number, number>();
  for (const a of asignaciones) vecesPorFila.set(a.fila, (vecesPorFila.get(a.fila) ?? 0) + 1);
  for (const fila of [...vecesPorFila.keys()].sort((x, y) => x - y)) {
    if ((vecesPorFila.get(fila) ?? 0) > 1) {
      discrepancias.push({ fila, motivo: `la fila ${fila} aparece dos veces en id-web.json` });
    }
  }

  const filasPorObra = new Map<number, number[]>();
  for (const a of asignaciones) filasPorObra.set(a.obraId, [...(filasPorObra.get(a.obraId) ?? []), a.fila]);
  for (const [obraId, filas] of filasPorObra) {
    if (filas.length > 1) {
      for (const fila of [...new Set(filas)].sort((x, y) => x - y)) {
        discrepancias.push({ fila, motivo: `la obra ${obraId} aparece en dos filas` });
      }
    }
  }

  return discrepancias.sort((x, y) => x.fila - y.fila);
}

export function verificarAsignaciones(
  asignaciones: AsignacionIdWeb[],
  actuales: Map<number, EstadoFila>
): Verificacion {
  const repetidas = duplicados(asignaciones);
  if (repetidas.length) return { ok: false, discrepancias: repetidas };

  const pendientes: AsignacionIdWeb[] = [];
  const discrepancias: Discrepancia[] = [];
  for (const a of [...asignaciones].sort((x, y) => x.fila - y.fila)) {
    const actual = actuales.get(a.fila);
    if (!actual) {
      discrepancias.push({ fila: a.fila, motivo: 'la fila no existe en la hoja' });
      continue;
    }
    const campos: [string, string | null | undefined, unknown][] = [
      ['autor', a.autor, actual.autor],
      ['titulo', a.titulo, actual.titulo],
      ['tecnica', a.tecnica, actual.tecnica],
      ['dimension', a.dimension, actual.dimension],
    ];
    const distintos = campos.filter(([, esperado, real]) => !coincide(esperado, real)).map(([nombre]) => nombre);
    if (distintos.length) {
      discrepancias.push({
        fila: a.fila,
        motivo: `la fila ya no coincide con la copia importada (difiere: ${distintos.join(', ')})`,
      });
      continue;
    }
    const id = normalizarCeldaHoja(actual.idWeb);
    if (id === null) pendientes.push(a);
    else if (Number(id) !== a.obraId) {
      discrepancias.push({ fila: a.fila, motivo: `ya tiene el ID WEB ${id}, se esperaba ${a.obraId}` });
    }
  }
  return discrepancias.length ? { ok: false, discrepancias } : { ok: true, pendientes };
}

/**
 * Cuando no existe la columna «ID WEB» se reclama la primera columna sin
 * encabezado, pero antes hay que comprobar que de verdad está libre: puede
 * tener datos sueltos que no son ID WEB y que una escritura ciega borraría.
 */
export function verificarColumnaVacia(
  asignaciones: AsignacionIdWeb[],
  actuales: Map<number, EstadoFila>,
  letra: string
): Discrepancia[] {
  const discrepancias: Discrepancia[] = [];
  for (const a of [...asignaciones].sort((x, y) => x.fila - y.fila)) {
    const actual = actuales.get(a.fila);
    const valor = actual ? normalizarCeldaHoja(actual.idWeb) : null;
    if (valor === null || Number(valor) === a.obraId) continue;
    discrepancias.push({ fila: a.fila, motivo: `la columna ${letra} ya tiene un valor en la fila ${a.fila}` });
  }
  return discrepancias;
}

export function esListaDeAsignaciones(datos: unknown): datos is AsignacionIdWeb[] {
  return (
    Array.isArray(datos) &&
    datos.every((a) => {
      if (typeof a !== 'object' || a === null) return false;
      const o = a as Record<string, unknown>;
      return (
        Number.isInteger(o['fila']) &&
        Number.isInteger(o['obraId']) &&
        (o['autor'] === null || typeof o['autor'] === 'string') &&
        (o['titulo'] === null || typeof o['titulo'] === 'string') &&
        (o['tecnica'] === undefined || o['tecnica'] === null || typeof o['tecnica'] === 'string') &&
        (o['dimension'] === undefined || o['dimension'] === null || typeof o['dimension'] === 'string')
      );
    })
  );
}
