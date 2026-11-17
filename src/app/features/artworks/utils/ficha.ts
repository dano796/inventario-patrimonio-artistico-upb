import { Artwork } from '../../../shared/models/artwork.model';
import { ArtworkImage } from '../../../shared/models/image.model';

export const NO_REGISTRA = 'No registra';

export interface CampoFicha {
  etiqueta: string;
  valor: string;
  vacio: boolean;
}

export const formatoPesos = (valor: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

/** Ubicación, bloque, valor, responsable y cargo son columnas restringidas. */
export function camposFicha(obra: Artwork, esAdmin: boolean): CampoFicha[] {
  const filas: [etiqueta: string, valor: string | number | null | undefined, restringido: boolean][] = [
    ['Técnica', obra.tecnica, false],
    ['Dimensión', obra.dimension, false],
    ['Año', obra.ano, false],
    ['Descripción', obra.descripcion, false],
    ['Ubicación', obra.ubicacion, true],
    ['Bloque asignado', obra.bloque_asignado, true],
    ['Valor estimado', obra.valor == null ? null : formatoPesos(obra.valor), true],
    ['Responsable', obra.responsable, true],
    ['Cargo', obra.cargo, true],
  ];
  return filas
    .filter(([, , restringido]) => esAdmin || !restringido)
    .map(([etiqueta, valor]) => {
      const texto = valor == null ? '' : String(valor).trim();
      return { etiqueta, valor: texto || NO_REGISTRA, vacio: !texto };
    });
}

export function subtituloFicha(obra: Artwork): string {
  const autor = obra.autor?.trim() || 'Autor no registrado';
  return obra.ano === null ? autor : `${autor}, ${obra.ano}`;
}

export function ultimaCaptura(imagenes: readonly ArtworkImage[]): string | null {
  const tiempos = imagenes
    .map((i) => (i.fecha_creacion ? new Date(i.fecha_creacion).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (!tiempos.length) return null;
  const fecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(Math.max(...tiempos))
  );
  return `Última captura ${fecha} (${imagenes.length} ${imagenes.length === 1 ? 'imagen' : 'imágenes'})`;
}

export function mensajeBorrado(titulo: string, imagenes: number): string {
  if (imagenes === 0) return `"${titulo}" se eliminará de forma permanente.`;
  const cuales = imagenes === 1 ? 'su imagen' : `sus ${imagenes} imágenes`;
  return `"${titulo}" y ${cuales} se eliminarán de forma permanente.`;
}
