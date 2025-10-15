export interface ArtworkImage {
  id?: string;
  artwork_id?: number;
  url: string;
  nombre: string;
  tamano?: number;
  created_at?: string;
}

export interface ImageUploadRequest {
  file: File;
  filename: string;
}

export interface ImageUploadResponse {
  url: string;
  filename: string;
  path: string;
}
