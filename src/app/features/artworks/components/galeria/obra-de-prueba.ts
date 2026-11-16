import { Artwork } from '../../../../shared/models/artwork.model';

export const obraDePrueba = (o: Partial<Artwork> = {}): Artwork => ({
  id: 14, autor: 'Ana Pérez', titulo: 'Paisaje', tecnica: 'Óleo', dimension: null, ano: 1998, ubicacion: 'Bloque 6',
  valor: 1200000, observaciones: null, descripcion: null, bloque_asignado: null, responsable_id: 9,
  responsable: 'JOBANY TOBÓN', cargo: 'COORDINADOR', imagenes: [], ...o,
});
