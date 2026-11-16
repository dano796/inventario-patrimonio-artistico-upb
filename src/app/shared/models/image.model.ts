export interface ArtworkImage {
  /** PK numerica en la tabla `imagenes`. Ausente mientras no se ha guardado. */
  id?: number;
  /** FK a `obras.id`. La columna se llama `id_obra`, no `artwork_id`. */
  id_obra?: number;
  url: string;
  nombre: string;
  tamano?: number;
  fecha_creacion?: string;
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
