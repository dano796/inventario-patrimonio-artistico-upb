export interface Coordenadas {
  columna: number;
  fila: number;
}

export function letraAColumna(letras: string): number {
  let columna = 0;
  for (const letra of letras) columna = columna * 26 + (letra.charCodeAt(0) - 64);
  return columna;
}

export function columnaALetra(columna: number): string {
  let letras = '';
  for (let n = columna; n > 0; n = Math.floor((n - 1) / 26)) {
    letras = String.fromCharCode(65 + ((n - 1) % 26)) + letras;
  }
  return letras;
}

export function separarReferencia(ref: string): Coordenadas {
  const partes = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!partes) throw new Error(`Referencia de celda no válida: ${ref}`);
  return { columna: letraAColumna(partes[1]), fila: Number(partes[2]) };
}

export function referencia(columna: number, fila: number): string {
  return `${columnaALetra(columna)}${fila}`;
}

export function expandirRango(rango: string): { desde: Coordenadas; hasta: Coordenadas } {
  const [desde, hasta = desde] = rango.split(':');
  return { desde: separarReferencia(desde), hasta: separarReferencia(hasta) };
}

export function agruparFilasContiguas(filas: number[]): { inicio: number; fin: number }[] {
  const grupos: { inicio: number; fin: number }[] = [];
  for (const fila of [...new Set(filas)].sort((a, b) => a - b)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && fila === ultimo.fin + 1) ultimo.fin = fila;
    else grupos.push({ inicio: fila, fin: fila });
  }
  return grupos;
}
