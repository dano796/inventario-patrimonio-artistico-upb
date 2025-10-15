import { ArtworkImage } from './image.model';

export interface Artwork {
  id: number;
  autor: string | null;
  titulo: string;
  tecnica: string | null;
  dimension: string | null;
  ano: number | null;
  ubicacion: string | null;
  valor: number | null;
  observaciones: string | null;
  responsable: string | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  imagenes?: ArtworkImage[];
}

export interface ArtworkCreateData {
  autor: string | null;
  titulo: string;
  tecnica: string | null;
  dimension: string | null;
  ano: number | null;
  ubicacion: string | null;
  valor: number | null;
  observaciones: string | null;
  responsable: string | null;
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
