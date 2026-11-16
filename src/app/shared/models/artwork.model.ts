import { ArtworkImage } from './image.model';

export interface Artwork {
  id: number;
  autor: string | null;
  titulo: string | null;
  tecnica: string | null;
  dimension: string | null;
  ano: number | null;
  ubicacion: string | null;
  valor: number | null;
  observaciones: string | null;
  descripcion: string | null;
  bloque_asignado: string | null;
  responsable_id: number | null;
  /** Nombre del responsable; solo lo devuelve `obras_admin`. */
  responsable: string | null;
  /** Cargo del responsable; solo lo devuelve `obras_admin`. */
  cargo: string | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  imagenes?: ArtworkImage[];
}

export interface ArtworkCreateData {
  autor: string | null;
  titulo: string | null;
  tecnica: string | null;
  dimension: string | null;
  ano: number | null;
  ubicacion: string | null;
  valor: number | null;
  observaciones: string | null;
  descripcion: string | null;
  bloque_asignado: string | null;
  responsable_id: number | null;
}

export interface ArtworkState {
  artworks: Artwork[];
  selectedArtwork: Artwork | null;
  loading: boolean;
  error: boolean;
  // Paginación
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  ubicacion?: string | string[]; // Permitir string único o array de strings
  responsable?: string;
  autor?: string;
  tecnica?: string;
}
