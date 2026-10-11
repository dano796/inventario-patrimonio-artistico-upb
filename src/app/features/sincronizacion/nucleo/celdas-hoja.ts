import { ValorCampo } from './foto';

export const NO_REGISTRA = 'No registra';

/** Excel toma como fórmula un texto que empieza por = + - @; el apóstrofo lo deja como texto. */
export function valorParaHoja(valor: ValorCampo): string | number {
  if (valor === null) return NO_REGISTRA;
  if (typeof valor === 'number') return valor;
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

export function formulaImagen(url: string, prefijo: string): string {
  if (!url.startsWith(prefijo) || /["\s]/.test(url)) throw new Error('La URL de la imagen no es del bucket');
  return `=IMAGE("${url}")`;
}
