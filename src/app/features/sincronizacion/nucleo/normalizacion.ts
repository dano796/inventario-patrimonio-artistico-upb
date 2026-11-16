/**
 * Reglas compartidas por la importación inicial (Node) y la sincronización
 * (navegador). Si difieren entre los dos lados, una segunda ejecución sin
 * cambios deja de dar un diff vacío.
 */

export type Conversion<T> = { ok: true; valor: T } | { ok: false; motivo: string };

export const MOTIVO_OTRA_MONEDA = 'el valor está en otra moneda';

const VALORES_ERROR_EXCEL = new Set([
  '#VALUE!', '#N/A', '#REF!', '#NAME?', '#DIV/0!', '#NUM!', '#NULL!',
  '#SPILL!', '#CALC!', '#BLOCKED!', '#CONNECT!', '#FIELD!', '#UNKNOWN!', '#BUSY!',
]);

export function esErrorDeExcel(valor: unknown): valor is string {
  return typeof valor === 'string' && VALORES_ERROR_EXCEL.has(valor.trim().toUpperCase());
}

const VACIOS = new Set(['', 'no registra']);
const OTRA_MONEDA = /(?:^|[^a-z])(?:usd|us\$|eur|euros?|d[oó]lar(?:es)?)(?![a-z])|€/i;
const ANO = /(?<!\d)\d{4}(?!\d)/g;

export function limpiarTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).replace(/\r\n?/g, '\n').trim();
  return VACIOS.has(texto.replace(/\s+/g, ' ').toLowerCase()) ? null : texto;
}

export function normalizarTexto(valor: unknown): string | null {
  const texto = limpiarTexto(valor);
  return texto === null ? null : texto.replace(/\s+/g, ' ');
}

export function claveNombre(valor: unknown): string | null {
  const texto = normalizarTexto(valor);
  return texto === null ? null : texto.toLocaleUpperCase('es');
}

export function claveEmparejamiento(valor: unknown): string {
  return (normalizarTexto(valor) ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function convertirAno(
  valor: unknown,
  anoActual = new Date().getFullYear()
): Conversion<number | null> {
  if (typeof valor === 'number') {
    const entero = Math.round(valor);
    if (Math.abs(valor - entero) > 1e-6) {
      return { ok: false, motivo: 'el año no es un número entero' };
    }
    return anoEnRango(entero, anoActual);
  }
  const texto = limpiarTexto(valor);
  if (texto === null) return { ok: true, valor: null };
  const anos = texto.match(ANO) ?? [];
  if (anos.length !== 1) {
    return {
      ok: false,
      motivo: anos.length ? 'hay más de un año' : 'no hay un año reconocible',
    };
  }
  return anoEnRango(Number(anos[0]), anoActual);
}

function anoEnRango(ano: number, anoActual: number): Conversion<number | null> {
  return ano >= 1000 && ano <= anoActual
    ? { ok: true, valor: ano }
    : { ok: false, motivo: `el año ${ano} está fuera de rango` };
}

export function convertirValor(valor: unknown): Conversion<number | null> {
  if (typeof valor === 'number') {
    return valor < 0
      ? { ok: false, motivo: 'el valor es negativo' }
      : { ok: true, valor: Math.round(valor) };
  }
  const texto = limpiarTexto(valor);
  if (texto === null) return { ok: true, valor: null };
  if (OTRA_MONEDA.test(texto)) return { ok: false, motivo: MOTIVO_OTRA_MONEDA };
  const cifra = texto.replace(/^\$/, '').replace(/\s/g, '');
  if (/^\d+$/.test(cifra) || /^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(cifra)) {
    return { ok: true, valor: Number(cifra.replace(/[.,]/g, '')) };
  }
  return { ok: false, motivo: 'formato de valor no reconocido' };
}
