import {
  Campo, CAMPOS, CamposObra, CasillaImagen, ENCABEZADO_ID_WEB, ENCABEZADOS, ENCABEZADOS_IMAGEN, FORMULA_IMAGEN,
} from './hoja-obras';
import { claveEmparejamiento, convertirAno, convertirValor, esErrorDeExcel, limpiarTexto } from './normalizacion';
import { normalizarCampo, ValorCampo } from './foto';
import { AltaEnHoja, DestinoHoja, EscrituraHoja } from './plan-ejecucion';
import { agruparFilasContiguas, columnaALetra, letraAColumna } from './rangos';

export interface ColumnasHoja {
  campos: Record<Campo, number>;
  imagenes: number[];
  idWeb: number;
}

export interface CeldaActual {
  valor: unknown;
  formula: unknown;
}

export interface LecturaActual {
  filaDeId: ReadonlyMap<number, number[]>;
  ultimaFila: number;
  celda(fila: number, columna: number): CeldaActual;
}

export interface EscrituraUbicada {
  escritura: EscrituraHoja;
  fila: number;
  columna: number;
}

export interface Descartada {
  escritura: EscrituraHoja;
  motivo: string;
}

export interface BloqueEscritura {
  direccion: string;
  valores: (string | number | null)[][];
  escrituras: EscrituraHoja[];
}

export interface BloqueAltas {
  direccion: string;
  valores: (string | number | null)[][];
  altas: AltaEnHoja[];
}

export interface ObraCreada {
  fila: number;
  obraId: number;
  campos: CamposObra;
  /** Graph devuelve vacías las celdas combinadas que no son la de origen; tampoco se comparan las no convertibles. */
  heredados: readonly Campo[];
  noConvertibles: readonly Campo[];
}

export const MOTIVO_SIN_FILA = 'la fila ya no está en el Excel';
export const MOTIVO_ID_REPETIDO = 'el ID WEB está repetido en el Excel';
export const MOTIVO_CELDA_CAMBIADA = 'la celda cambió desde que se calculó el diff';

export function columnasDeEncabezados(
  encabezados: readonly unknown[]
): ColumnasHoja | { faltantes: string[]; repetidos: string[] } {
  const posicion = new Map<string, number>();
  const vistos = new Map<string, number>();
  encabezados.forEach((e, i) => {
    const clave = claveEmparejamiento(e);
    if (!clave) return;
    if (!posicion.has(clave)) posicion.set(clave, i + 1);
    vistos.set(clave, (vistos.get(clave) ?? 0) + 1);
  });
  const faltantes: string[] = [];
  const repetidos: string[] = [];
  const buscar = (nombre: string) => {
    const clave = claveEmparejamiento(nombre);
    const columna = posicion.get(clave);
    if (columna === undefined) faltantes.push(nombre);
    if ((vistos.get(clave) ?? 0) > 1) repetidos.push(nombre);
    return columna ?? 0;
  };
  const campos = Object.fromEntries(CAMPOS.map((c) => [c, buscar(ENCABEZADOS[c])])) as Record<Campo, number>;
  const imagenes = ENCABEZADOS_IMAGEN.map(buscar);
  const idWeb = buscar(ENCABEZADO_ID_WEB);
  return faltantes.length || repetidos.length ? { faltantes, repetidos } : { campos, imagenes, idWeb };
}

export function origenDeDireccion(direccion: string): { fila: number; columna: number } {
  const inicio = /^\$?([A-Z]+)\$?(\d+)/.exec(direccion.split('!').pop() ?? '');
  if (!inicio) throw new Error(`Dirección de rango no reconocida: ${direccion}`);
  return { columna: letraAColumna(inicio[1]), fila: Number(inicio[2]) };
}

export function lecturaDesdeRango(
  valores: unknown[][],
  formulas: unknown[][],
  columnaIdWeb: number,
  origen = { fila: 1, columna: 1 }
): LecturaActual {
  const filaDeId = new Map<number, number[]>();
  let ultimaFila = origen.fila - 1;
  valores.forEach((celdas, i) => {
    const fila = origen.fila + i;
    if (celdas.some((v) => v !== '' && v !== null)) ultimaFila = fila;
    if (fila === 1) return;
    const crudo = celdas[columnaIdWeb - origen.columna];
    const id = typeof crudo === 'number' ? crudo : typeof crudo === 'string' && /^\s*\d+\s*$/.test(crudo) ? Number(crudo) : NaN;
    if (Number.isInteger(id) && id > 0) filaDeId.set(id, [...(filaDeId.get(id) ?? []), fila]);
  });
  return {
    filaDeId,
    ultimaFila,
    celda: (fila, columna) => ({
      valor: valores[fila - origen.fila]?.[columna - origen.columna] ?? '',
      formula: formulas[fila - origen.fila]?.[columna - origen.columna] ?? '',
    }),
  };
}

export function columnaDe(destino: DestinoHoja, columnas: ColumnasHoja): number {
  if (destino.tipo === 'campo') return columnas.campos[destino.campo];
  if (destino.tipo === 'imagen') return columnas.imagenes[destino.casilla - 1];
  return columnas.idWeb;
}

/** `undefined`: la celda tiene algo que no se puede convertir, así que no coincide con nada leído. */
function valorDeCelda(campo: Campo, celda: CeldaActual): ValorCampo | undefined {
  const valor = esErrorDeExcel(celda.valor) ? null : celda.valor;
  if (campo === 'ano' || campo === 'valor') {
    const conversion = campo === 'ano' ? convertirAno(valor) : convertirValor(valor);
    return conversion.ok ? conversion.valor : undefined;
  }
  return limpiarTexto(valor);
}

type CasillaActual = { tipo: 'vacia' } | { tipo: 'formula'; url: string | null } | { tipo: 'otra'; texto: string | null };

/** Una imagen pegada en celda llega de Graph como error (#VALUE!): no es una casilla vacía. */
function casillaDeCelda(celda: CeldaActual): CasillaActual {
  const formula = typeof celda.formula === 'string' ? celda.formula : '';
  const imagen = FORMULA_IMAGEN.exec(formula.replace(/^=/, ''));
  if (imagen) return { tipo: 'formula', url: imagen[1] || null };
  if (esErrorDeExcel(celda.valor)) return { tipo: 'otra', texto: null };
  const texto = limpiarTexto(celda.valor);
  return texto === null ? { tipo: 'vacia' } : { tipo: 'otra', texto };
}

export function coincideConLoLeido(escritura: EscrituraHoja, celda: CeldaActual): boolean {
  const destino = escritura.destino;
  if (destino.tipo === 'id_web') return casillaDeCelda(celda).tipo === 'vacia';
  if (destino.tipo === 'campo') {
    const actual = valorDeCelda(destino.campo, celda);
    return (
      actual !== undefined &&
      normalizarCampo(destino.campo, actual) === normalizarCampo(destino.campo, escritura.leido as ValorCampo)
    );
  }
  const leida = escritura.leido as CasillaImagen;
  const actual = casillaDeCelda(celda);
  if (leida.tipo === 'vacia') return actual.tipo === 'vacia';
  if (leida.tipo === 'formula') return actual.tipo === 'formula' && actual.url === leida.url;
  if (leida.tipo === 'texto') return actual.tipo === 'otra' && actual.texto === limpiarTexto(leida.valor);
  return actual.tipo === 'otra';
}

export function ubicarEscrituras(
  escrituras: readonly EscrituraHoja[],
  lectura: LecturaActual,
  columnas: ColumnasHoja
): { ubicadas: EscrituraUbicada[]; descartadas: Descartada[] } {
  const ubicadas: EscrituraUbicada[] = [];
  const descartadas: Descartada[] = [];
  for (const escritura of escrituras) {
    const filas = lectura.filaDeId.get(escritura.obraId) ?? [];
    if (filas.length !== 1) {
      descartadas.push({ escritura, motivo: filas.length ? MOTIVO_ID_REPETIDO : MOTIVO_SIN_FILA });
      continue;
    }
    const columna = columnaDe(escritura.destino, columnas);
    if (!coincideConLoLeido(escritura, lectura.celda(filas[0], columna))) {
      descartadas.push({ escritura, motivo: MOTIVO_CELDA_CAMBIADA });
      continue;
    }
    ubicadas.push({ escritura, fila: filas[0], columna });
  }
  return { ubicadas, descartadas };
}

/** Una obra creada desde una fila sin ID no se puede localizar por ID: se exige que la fila siga siendo la misma. */
export function ubicarIdsNuevos(
  creadas: readonly ObraCreada[],
  lectura: LecturaActual,
  columnas: ColumnasHoja
): { ubicadas: EscrituraUbicada[]; descartadas: Descartada[] } {
  const ubicadas: EscrituraUbicada[] = [];
  const descartadas: Descartada[] = [];
  for (const c of creadas) {
    const escritura: EscrituraHoja = {
      obraId: c.obraId, fila: c.fila, destino: { tipo: 'id_web' }, valor: c.obraId, leido: null, foto: {},
    };
    const comparables = CAMPOS.filter((campo) => !c.heredados.includes(campo) && !c.noConvertibles.includes(campo));
    const mismaFila = comparables.every((campo) => {
      const actual = valorDeCelda(campo, lectura.celda(c.fila, columnas.campos[campo]));
      return actual !== undefined && normalizarCampo(campo, actual) === normalizarCampo(campo, c.campos[campo]);
    });
    if (mismaFila && coincideConLoLeido(escritura, lectura.celda(c.fila, columnas.idWeb))) {
      ubicadas.push({ escritura, fila: c.fila, columna: columnas.idWeb });
    } else {
      descartadas.push({ escritura, motivo: MOTIVO_CELDA_CAMBIADA });
    }
  }
  return { ubicadas, descartadas };
}

export function agruparEnBloques(ubicadas: readonly EscrituraUbicada[]): BloqueEscritura[] {
  const porColumna = new Map<number, Map<number, EscrituraUbicada>>();
  for (const u of ubicadas) {
    const porFila = porColumna.get(u.columna) ?? new Map<number, EscrituraUbicada>();
    porFila.set(u.fila, u);
    porColumna.set(u.columna, porFila);
  }
  const bloques: BloqueEscritura[] = [];
  for (const [columna, porFila] of [...porColumna].sort(([a], [b]) => a - b)) {
    const letra = columnaALetra(columna);
    for (const { inicio, fin } of agruparFilasContiguas([...porFila.keys()])) {
      const tramo = Array.from({ length: fin - inicio + 1 }, (_, i) => porFila.get(inicio + i)!);
      bloques.push({
        direccion: `${letra}${inicio}:${letra}${fin}`,
        valores: tramo.map((u) => [u.escritura.valor]),
        escrituras: tramo.map((u) => u.escritura),
      });
    }
  }
  return bloques;
}

export function bloqueDeAltas(altas: readonly AltaEnHoja[], primeraFila: number, columnas: ColumnasHoja): BloqueAltas | null {
  if (!altas.length) return null;
  const ultimaColumna = Math.max(columnas.idWeb, ...Object.values(columnas.campos), ...columnas.imagenes);
  const valores = altas.map((alta) => {
    const fila: (string | number | null)[] = Array(ultimaColumna).fill(null);
    for (const celda of alta.celdas) fila[columnaDe(celda.destino, columnas) - 1] = celda.valor;
    fila[columnas.idWeb - 1] = alta.obraId;
    return fila;
  });
  const fin = primeraFila + altas.length - 1;
  return { direccion: `A${primeraFila}:${columnaALetra(ultimaColumna)}${fin}`, valores, altas: [...altas] };
}
