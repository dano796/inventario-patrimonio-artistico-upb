const VARIANTES: Record<string, string> = {
  a: 'aáàâäAÁÀÂÄ',
  e: 'eéèêëEÉÈÊË',
  i: 'iíìîïIÍÌÎÏ',
  o: 'oóòôöOÓÒÔÖ',
  u: 'uúùûüUÚÙÛÜ',
  n: 'nñNÑ',
};

/**
 * Patrón para el operador `imatch` de PostgREST que encuentra el texto con o
 * sin tildes. Las mayúsculas acentuadas van en la clase porque, según la
 * collation de la base, `imatch` puede no plegarlas.
 */
export function patronSinTildes(texto: string): string {
  return [...texto.trim().normalize('NFD').replace(/[̀-ͯ]/g, '')]
    .map((c) => {
      const variantes = VARIANTES[c.toLowerCase()];
      if (variantes) return `[${variantes}]`;
      return /[.*+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
    })
    .join('');
}
