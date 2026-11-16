export const ENCABEZADOS_HOJA = [
  'NÚMERO DE INVENTARIO', 'AUTOR', 'TITULO', 'TECNICA', 'DIMENSION (cm)', 'FECHA ELABORACIÓN', 'UBICACIÓN',
  'BLOQUE ASIGNADO', 'VALOR', 'DESCRIPCION', 'RESPONSABLE', 'CARGO', 'OBSERVACIONES', 'IMAGEN 1', 'IMAGEN 2',
  'IMAGEN 3', 'OBSERVACION JEFFERSON 26 DE MARZO 2026', 'ID WEB',
] as const;

export interface CeldaFormula {
  formula: string;
  valor?: unknown;
}

export type FilaDePrueba = Partial<Record<(typeof ENCABEZADOS_HOJA)[number], unknown>>;

const esFormula = (v: unknown): v is CeldaFormula => typeof v === 'object' && v !== null && 'formula' in v;

/** Imita la respuesta de `usedRange?$select=address,values,formulas` de Graph. */
export function rangoDePrueba(filas: FilaDePrueba[]): { address: string; values: unknown[][]; formulas: unknown[][] } {
  const celdas: unknown[][] = [[...ENCABEZADOS_HOJA], ...filas.map((f) => ENCABEZADOS_HOJA.map((e) => f[e] ?? ''))];
  return {
    address: `'Inventario Obras'!A1:R${celdas.length}`,
    values: celdas.map((fila) => fila.map((v) => (esFormula(v) ? v.valor ?? 0 : v))),
    formulas: celdas.map((fila) => fila.map((v) => (esFormula(v) ? v.formula : v))),
  };
}
