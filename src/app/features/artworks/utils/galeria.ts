import { guardarAlmacen, leerAlmacen } from '../../../shared/utils/almacen';

export type Vista = 'galeria' | 'mosaico' | 'tabla';
export const CLAVE_VISTA = 'galeria-vista';
const VISTAS: readonly Vista[] = ['galeria', 'mosaico', 'tabla'];

export function leerVista(): Vista {
  const guardada = leerAlmacen(CLAVE_VISTA);
  return VISTAS.find((v) => v === guardada) ?? 'galeria';
}

export function guardarVista(vista: Vista): void {
  guardarAlmacen(CLAVE_VISTA, vista);
}

/** Múltiplos de las columnas de cada vista, para que las filas queden completas. */
export const tamanoPagina = (vista: Vista) => (vista === 'mosaico' ? 30 : 24);

export type ClaveFiltro = 'busqueda' | 'ubicacion' | 'responsable' | 'autor' | 'tecnica';

export interface ValoresFiltros {
  busqueda: string;
  ubicacion: string;
  ubicaciones: readonly string[];
  responsable: string;
  autor: string;
  tecnica: string;
}

export interface ChipFiltro {
  clave: ClaveFiltro;
  valor: string;
  texto: string;
}

const NOMBRES: Record<ClaveFiltro, string> = {
  busqueda: 'Título',
  ubicacion: 'Ubicación',
  responsable: 'Responsable',
  autor: 'Autor',
  tecnica: 'Técnica',
};

/** Ubicación y responsable son columnas restringidas: sin rol de administrador no se muestran ni como filtro. */
export function chipsFiltros(valores: ValoresFiltros, esAdmin: boolean): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  const agregar = (clave: ClaveFiltro, valor: string) => {
    const limpio = valor.trim();
    if (limpio) chips.push({ clave, valor: limpio, texto: `${NOMBRES[clave]}: ${limpio}` });
  };
  agregar('busqueda', valores.busqueda);
  if (esAdmin) {
    if (valores.ubicaciones.length) valores.ubicaciones.forEach((u) => agregar('ubicacion', u));
    else agregar('ubicacion', valores.ubicacion);
    agregar('responsable', valores.responsable);
  }
  agregar('autor', valores.autor);
  agregar('tecnica', valores.tecnica);
  return chips;
}

function unirConY(partes: readonly string[]): string {
  return partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

export function lineaResultado(total: number, chips: readonly ChipFiltro[]): string {
  const criterios = [...new Set(chips.map((c) => NOMBRES[c.clave].toLocaleLowerCase('es')))];
  if (total === 0) return criterios.length ? 'Ninguna obra coincide con los filtros' : 'Todavía no hay obras';
  const obras = total === 1 ? '1 obra' : `${total.toLocaleString('es-CO')} obras`;
  if (!criterios.length) return obras;
  return `${obras} ${total === 1 ? 'filtrada' : 'filtradas'} por ${unirConY(criterios)}`;
}
