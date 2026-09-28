import { normalizarTexto } from './normalizacion';

export interface AsignacionIdWeb {
  fila: number;
  obraId: number;
  autor: string | null;
  titulo: string | null;
}

export interface EstadoFila {
  autor: unknown;
  titulo: unknown;
  idWeb: unknown;
}

export interface Discrepancia {
  fila: number;
  motivo: string;
}

export type Verificacion =
  | { ok: true; pendientes: AsignacionIdWeb[] }
  | { ok: false; discrepancias: Discrepancia[] };

export function verificarAsignaciones(
  asignaciones: AsignacionIdWeb[],
  actuales: Map<number, EstadoFila>
): Verificacion {
  const pendientes: AsignacionIdWeb[] = [];
  const discrepancias: Discrepancia[] = [];
  for (const a of [...asignaciones].sort((x, y) => x.fila - y.fila)) {
    const actual = actuales.get(a.fila);
    if (!actual) {
      discrepancias.push({ fila: a.fila, motivo: 'la fila no existe en la hoja' });
      continue;
    }
    if (normalizarTexto(actual.autor) !== normalizarTexto(a.autor) || normalizarTexto(actual.titulo) !== normalizarTexto(a.titulo)) {
      discrepancias.push({
        fila: a.fila,
        motivo: `se esperaba «${a.autor ?? ''} · ${a.titulo ?? ''}» y hay «${normalizarTexto(actual.autor) ?? ''} · ${normalizarTexto(actual.titulo) ?? ''}»`,
      });
      continue;
    }
    const id = normalizarTexto(actual.idWeb);
    if (id === null) pendientes.push(a);
    else if (Number(id) !== a.obraId) {
      discrepancias.push({ fila: a.fila, motivo: `ya tiene el ID WEB ${id}, se esperaba ${a.obraId}` });
    }
  }
  return discrepancias.length ? { ok: false, discrepancias } : { ok: true, pendientes };
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
        (o['titulo'] === null || typeof o['titulo'] === 'string')
      );
    })
  );
}
