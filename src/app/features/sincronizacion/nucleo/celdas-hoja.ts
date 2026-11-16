import { ValorCampo } from './foto';

export const NO_REGISTRA = 'No registra';

/**
 * Graph interpreta cada texto como si se tecleara: «=…» sería una fórmula y
 * «30/40», «0123» o «50%» se convertirían en fecha o número. El apóstrofo
 * inicial lo deja como texto y Excel no lo guarda en el valor de la celda.
 */
export function valorParaHoja(valor: ValorCampo): string | number {
  if (typeof valor === 'number') return valor;
  return `'${valor ?? NO_REGISTRA}`;
}

/** Una comilla o un espacio romperían la fórmula =IMAGE("…"). */
export const esUrlEscribible = (url: string, prefijo: string) => url.startsWith(prefijo) && !/["\s]/.test(url);

export function formulaImagen(url: string, prefijo: string): string {
  if (!esUrlEscribible(url, prefijo)) throw new Error('La URL de la imagen no es del bucket');
  return `=IMAGE("${url}")`;
}
