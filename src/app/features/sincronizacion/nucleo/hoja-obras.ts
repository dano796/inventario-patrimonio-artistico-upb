import { Celda, Hoja } from './leer-xlsx';
import { claveEmparejamiento, Conversion, convertirAno, convertirValor, esErrorDeExcel, limpiarTexto } from './normalizacion';
import { expandirRango, referencia, separarReferencia } from './rangos';

export const CAMPOS_TEXTO = [
  'autor', 'titulo', 'tecnica', 'dimension', 'ubicacion', 'bloque_asignado',
  'descripcion', 'responsable', 'cargo', 'observaciones',
] as const;
export type CampoTexto = (typeof CAMPOS_TEXTO)[number];
export type Campo = CampoTexto | 'ano' | 'valor';
export const CAMPOS: readonly Campo[] = [...CAMPOS_TEXTO, 'ano', 'valor'];
export type CamposObra = Record<CampoTexto, string | null> & { ano: number | null; valor: number | null };

export const ENCABEZADOS: Record<Campo, string> = {
  autor: 'AUTOR',
  titulo: 'TITULO',
  tecnica: 'TECNICA',
  dimension: 'DIMENSION (cm)',
  ano: 'FECHA ELABORACIÓN',
  ubicacion: 'UBICACIÓN',
  bloque_asignado: 'BLOQUE ASIGNADO',
  valor: 'VALOR',
  descripcion: 'DESCRIPCION',
  responsable: 'RESPONSABLE',
  cargo: 'CARGO',
  observaciones: 'OBSERVACIONES',
};
export const ENCABEZADOS_IMAGEN = ['IMAGEN 1', 'IMAGEN 2', 'IMAGEN 3'] as const;
export const ENCABEZADO_ID_WEB = 'ID WEB';

export type CasillaImagen =
  | { tipo: 'vacia' }
  | { tipo: 'pegada'; archivo: string | null }
  | { tipo: 'formula'; url: string | null }
  | { tipo: 'texto'; valor: string };

export interface AvisoFila {
  fila: number;
  campo: Campo | 'id_web' | 'imagen_1' | 'imagen_2' | 'imagen_3';
  motivo: string;
  original: string;
}

export interface FilaHoja {
  fila: number;
  idWeb: number | null;
  campos: CamposObra;
  noConvertibles: Campo[];
  combinados: Campo[];
  /** Celdas combinadas que no son la de origen: Graph las devuelve vacías. */
  heredados: Campo[];
  imagenes: CasillaImagen[];
}

export interface ResultadoHoja {
  columnas: Record<Campo, number>;
  columnasImagen: number[];
  columnaIdWeb: number | null;
  filas: FilaHoja[];
  avisos: AvisoFila[];
}

export class ErrorEncabezados extends Error {
  constructor(readonly faltantes: string[]) {
    super(`Faltan encabezados en la hoja: ${faltantes.join(', ')}`);
  }
}

const FORMULA_IMAGEN = /^(?:_xlfn\.)?IMAGE\(\s*"([^"]*)"/i;

export function leerFilasObras(hoja: Hoja): ResultadoHoja {
  const encabezados = new Map<string, number>();
  let ultimaFila = 1;
  for (const [ref, celda] of hoja.celdas) {
    const { columna, fila } = separarReferencia(ref);
    ultimaFila = Math.max(ultimaFila, fila);
    if (fila === 1 && celda.tipo === 'texto') encabezados.set(claveEmparejamiento(celda.valor), columna);
  }
  const buscar = (nombre: string) => encabezados.get(claveEmparejamiento(nombre));

  const faltantes: string[] = [];
  const columnas = {} as Record<Campo, number>;
  for (const campo of CAMPOS) {
    const columna = buscar(ENCABEZADOS[campo]);
    if (columna === undefined) faltantes.push(ENCABEZADOS[campo]);
    else columnas[campo] = columna;
  }
  const columnasImagen = ENCABEZADOS_IMAGEN.map((nombre) => {
    const columna = buscar(nombre);
    if (columna === undefined) faltantes.push(nombre);
    return columna ?? 0;
  });
  if (faltantes.length) throw new ErrorEncabezados(faltantes);
  const columnaIdWeb = buscar(ENCABEZADO_ID_WEB) ?? null;

  const origenCombinado = new Map<string, string>();
  for (const rango of hoja.combinadas) {
    const { desde, hasta } = expandirRango(rango);
    for (let f = desde.fila; f <= hasta.fila; f++) {
      for (let c = desde.columna; c <= hasta.columna; c++) {
        origenCombinado.set(referencia(c, f), referencia(desde.columna, desde.fila));
      }
    }
  }
  const celda = (columna: number, fila: number): Celda | undefined => {
    const ref = referencia(columna, fila);
    return hoja.celdas.get(origenCombinado.get(ref) ?? ref);
  };

  const filas: FilaHoja[] = [];
  const avisos: AvisoFila[] = [];
  for (let fila = 2; fila <= ultimaFila; fila++) {
    const avisar = (campo: AvisoFila['campo'], motivo: string, original: string) =>
      avisos.push({ fila, campo, motivo, original });
    const campos = {} as CamposObra;
    const noConvertibles: Campo[] = [];
    const combinados: Campo[] = [];
    const heredados: Campo[] = [];

    for (const campo of CAMPOS) {
      const c = celda(columnas[campo], fila);
      const ref = referencia(columnas[campo], fila);
      const origen = origenCombinado.get(ref);
      if (origen !== undefined) combinados.push(campo);
      if (origen !== undefined && origen !== ref) heredados.push(campo);
      if (c?.tipo === 'imagen' || c?.tipo === 'error') {
        (campos as Record<Campo, unknown>)[campo] = null;
        noConvertibles.push(campo);
        avisar(
          campo,
          c.tipo === 'imagen' ? 'la celda contiene una imagen' : 'la celda tiene un error de Excel',
          c.tipo === 'error' ? c.valor : '(imagen)'
        );
        continue;
      }
      const crudo = valorPrimitivo(c);
      if (campo === 'ano' || campo === 'valor') {
        const conversion: Conversion<number | null> =
          campo === 'ano' ? convertirAno(crudo) : convertirValor(crudo);
        if (conversion.ok) {
          campos[campo] = conversion.valor;
        } else {
          campos[campo] = null;
          noConvertibles.push(campo);
          avisar(campo, conversion.motivo, String(crudo));
        }
      } else {
        campos[campo] = limpiarTexto(crudo);
      }
    }

    const imagenes = columnasImagen.map((columna, i) => {
      const c = celda(columna, fila);
      const resultado = casilla(c);
      const error = errorDeExcel(c);
      if (resultado.tipo === 'vacia' && error !== null) {
        avisar(`imagen_${i + 1}` as AvisoFila['campo'], 'la celda tiene un error de Excel', error);
      }
      return resultado;
    });
    const idWeb =
      columnaIdWeb === null
        ? null
        : leerIdWeb(celda(columnaIdWeb, fila), (motivo, original) => avisar('id_web', motivo, original));
    const vacia =
      CAMPOS.every((c) => campos[c] === null) &&
      noConvertibles.length === 0 &&
      imagenes.every((i) => i.tipo === 'vacia') &&
      idWeb === null;
    if (!vacia) filas.push({ fila, idWeb, campos, noConvertibles, combinados, heredados, imagenes });
  }
  return { columnas, columnasImagen, columnaIdWeb, filas, avisos };
}

function valorPrimitivo(c: Celda | undefined): string | number | null {
  if (!c) return null;
  if (c.tipo === 'texto' || c.tipo === 'numero' || c.tipo === 'formula') return c.valor;
  return null;
}

function errorDeExcel(c: Celda | undefined): string | null {
  if (c?.tipo === 'error') return c.valor;
  if (c?.tipo === 'formula' && esErrorDeExcel(c.valor)) return c.valor;
  return null;
}

function casilla(c: Celda | undefined): CasillaImagen {
  if (!c) return { tipo: 'vacia' };
  if (c.tipo === 'imagen') return { tipo: 'pegada', archivo: c.archivo };
  if (c.tipo === 'formula') {
    const imagen = FORMULA_IMAGEN.exec(c.formula);
    if (imagen) return { tipo: 'formula', url: imagen[1] || null };
  }
  if (errorDeExcel(c) !== null) return { tipo: 'vacia' };
  const texto = limpiarTexto(valorPrimitivo(c));
  return texto === null ? { tipo: 'vacia' } : { tipo: 'texto', valor: texto };
}

function leerIdWeb(
  c: Celda | undefined,
  avisar: (motivo: string, original: string) => void
): number | null {
  const error = errorDeExcel(c);
  if (error !== null) {
    avisar('la celda tiene un error de Excel', error);
    return null;
  }
  const crudo = valorPrimitivo(c);
  if (limpiarTexto(crudo) === null) return null;
  const numero = typeof crudo === 'number' ? crudo : Number(String(crudo).trim());
  if (Number.isInteger(numero) && numero > 0) return numero;
  avisar('el ID WEB no es un número entero positivo', String(crudo));
  return null;
}
