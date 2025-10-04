import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  ArtworkImage,
  ImageUploadRequest,
} from '../../../shared/models/artwork-image.model';
import { ImageService } from '../../../shared/services/image.service';

interface Artwork {
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

interface ArtworkCreateData {
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

interface ArtworkState {
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

interface PaginationParams {
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ArtworksService {
  private supabaseClient = inject(SupabaseService).supabaseClient;
  private imageService = inject(ImageService);

  private state = signal<ArtworkState>({
    artworks: [],
    selectedArtwork: null,
    loading: false,
    error: false,
    currentPage: 1,
    totalItems: 0,
    itemsPerPage: 12,
    totalPages: 0,
  });

  // Variable para evitar llamadas concurrentes
  private loadingPromise: Promise<any> | null = null;

  // Selectores
  artworks = computed(() => this.state().artworks);
  selectedArtwork = computed(() => this.state().selectedArtwork);
  loading = computed(() => this.state().loading);
  error = computed(() => this.state().error);

  // Selectores de paginación
  currentPage = computed(() => this.state().currentPage);
  totalItems = computed(() => this.state().totalItems);
  itemsPerPage = computed(() => this.state().itemsPerPage);
  totalPages = computed(() => this.state().totalPages);

  // Computed para información de paginación
  startItem = computed(
    () => (this.currentPage() - 1) * this.itemsPerPage() + 1
  );
  endItem = computed(() =>
    Math.min(this.currentPage() * this.itemsPerPage(), this.totalItems())
  );
  hasPreviousPage = computed(() => this.currentPage() > 1);
  hasNextPage = computed(() => this.currentPage() < this.totalPages());

  async getAllArtworks(params: PaginationParams = {}) {
    try {
      const page = params.page || this.state().currentPage;
      const limit = params.limit || this.state().itemsPerPage;

      this.state.update((state) => ({
        ...state,
        loading: true,
        currentPage: page,
      }));

      // Calcular el rango para la paginación
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit - 1;

      // Consulta con paginación y conteo total
      const { data, error, count } = await this.supabaseClient
        .from('obras')
        .select(
          `
          *,
          imagenes(*)
        `,
          { count: 'exact' }
        )
        .range(startIndex, endIndex)
        .order('fecha_creacion', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        const totalItems = count || 0;
        const totalPages = Math.ceil(totalItems / limit);

        this.state.update((state) => ({
          ...state,
          artworks: data,
          totalItems,
          totalPages,
          itemsPerPage: limit,
        }));
      }
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        error: true,
      }));
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
    }
  }

  // Métodos de navegación de páginas
  async goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      await this.getAllArtworks({ page });
    }
  }

  async goToFirstPage() {
    await this.goToPage(1);
  }

  async goToLastPage() {
    await this.goToPage(this.totalPages());
  }

  // Método para validar número de página
  isValidPageNumber(page: number): boolean {
    return page >= 1 && page <= this.totalPages() && Number.isInteger(page);
  }

  // Obtener rango de páginas para mostrar en el paginador
  getPageRange(): number[] {
    const current = this.currentPage();
    const total = this.totalPages();
    const range: number[] = [];

    if (total <= 7) {
      // Si hay 7 o menos páginas, mostrar todas
      for (let i = 1; i <= total; i++) {
        range.push(i);
      }
    } else {
      // Lógica para páginas con rango inteligente
      if (current <= 4) {
        // Inicio: 1,2,3,4,5...last
        for (let i = 1; i <= 5; i++) {
          range.push(i);
        }
        range.push(-1); // Indicador de "..."
        range.push(total);
      } else if (current >= total - 3) {
        // Final: 1...n-4,n-3,n-2,n-1,n
        range.push(1);
        range.push(-1);
        for (let i = total - 4; i <= total; i++) {
          range.push(i);
        }
      } else {
        // Medio: 1...current-1,current,current+1...last
        range.push(1);
        range.push(-1);
        for (let i = current - 1; i <= current + 1; i++) {
          range.push(i);
        }
        range.push(-2); // Segundo indicador de "..."
        range.push(total);
      }
    }
    return range;
  }

  async nextPage() {
    if (this.hasNextPage()) {
      await this.goToPage(this.currentPage() + 1);
    }
  }

  async previousPage() {
    if (this.hasPreviousPage()) {
      await this.goToPage(this.currentPage() - 1);
    }
  }

  async firstPage() {
    await this.goToPage(1);
  }

  async lastPage() {
    await this.goToPage(this.totalPages());
  }

  async getArtworkById(id: number) {
    // Evitar llamadas concurrentes
    if (this.loadingPromise) {
      await this.loadingPromise;
    }

    this.loadingPromise = this._getArtworkById(id);
    return this.loadingPromise;
  }

  private async _getArtworkById(id: number) {
    try {
      this.state.update((state) => ({
        ...state,
        loading: true,
        selectedArtwork: null,
        error: false,
      }));

      // Timeout para evitar carga infinita
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Artwork load timeout')), 15000)
      );

      const artworkPromise = this.supabaseClient
        .from('obras')
        .select(
          `
          *,
          imagenes(*)
        `
        )
        .eq('id', id)
        .single();

      const { data, error } = (await Promise.race([
        artworkPromise,
        timeoutPromise,
      ])) as any;

      if (error) {
        throw error;
      }

      if (data) {
        this.state.update((state) => ({
          ...state,
          selectedArtwork: data,
        }));
      }
    } catch (error) {
      console.error('Error loading artwork:', error);
      this.state.update((state) => ({
        ...state,
        error: true,
        selectedArtwork: null,
      }));
      throw error;
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
      this.loadingPromise = null;
    }
  }

  clearSelectedArtwork() {
    // Cancelar cualquier carga pendiente
    this.loadingPromise = null;

    this.state.update((state) => ({
      ...state,
      selectedArtwork: null,
      error: false,
      loading: false,
    }));
  }

  async createArtwork(artworkData: ArtworkCreateData, imageFiles: File[] = []) {
    try {
      this.state.update((state) => ({
        ...state,
        loading: true,
        error: false,
      }));

      // Crear la obra primero
      const { data: artworkRecord, error: artworkError } =
        await this.supabaseClient
          .from('obras')
          .insert(artworkData)
          .select()
          .single();

      if (artworkError) {
        throw artworkError;
      }

      // Si hay archivos de imagen, subirlos al Storage
      if (imageFiles.length > 0 && artworkRecord) {
        // Preparar requests de subida
        const imageRequests: ImageUploadRequest[] = imageFiles.map((file) => ({
          file,
          filename: file.name,
        }));

        // Subir imágenes al Storage
        const uploadedImages = await this.imageService.uploadMultipleImages(
          imageRequests
        );

        // Guardar referencias en la base de datos
        const imageRecords = uploadedImages.map((uploadResult) => ({
          id_obra: artworkRecord.id, // Usando el nombre correcto de la columna
          url: uploadResult.url,
          nombre: uploadResult.filename,
          tamano:
            imageFiles.find((f) => f.name === uploadResult.filename)?.size || 0,
        }));

        const { error: imagesError } = await this.supabaseClient
          .from('imagenes')
          .insert(imageRecords);

        if (imagesError) {
          // Si falla la inserción de imágenes, eliminar los archivos subidos
          const pathsToDelete = uploadedImages.map((img) =>
            this.imageService.getPathFromUrl(img.url)
          );
          await this.imageService.deleteMultipleImages(pathsToDelete);
          throw imagesError;
        }
      }

      // Recargar la lista de obras
      await this.getAllArtworks();

      return artworkRecord;
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        error: true,
      }));
      throw error;
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
    }
  }

  async updateArtwork(
    id: number,
    artworkData: Partial<ArtworkCreateData>,
    newImageFiles: File[] = [],
    existingImages: ArtworkImage[] = []
  ) {
    try {
      this.state.update((state) => ({
        ...state,
        loading: true,
        error: false,
      }));

      // Actualizar los datos de la obra con la fecha de actualización
      const updateData = {
        ...artworkData,
        fecha_actualizacion: new Date().toISOString(),
      };

      const { data: artworkRecord, error: artworkError } =
        await this.supabaseClient
          .from('obras')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

      if (artworkError) {
        throw artworkError;
      }

      // Obtener las imágenes actuales de la base de datos
      const { data: currentImages, error: currentImagesError } =
        await this.supabaseClient
          .from('imagenes')
          .select('*')
          .eq('id_obra', id);

      if (currentImagesError) {
        throw currentImagesError;
      }

      // Determinar qué imágenes eliminar (las que están en BD pero no en existingImages)
      const imagesToDelete = (currentImages || []).filter(
        (dbImage) =>
          !existingImages.some((existing) => existing.id === dbImage.id)
      );

      // Eliminar imágenes que ya no se necesitan
      if (imagesToDelete.length > 0) {
        // Eliminar archivos del Storage
        const pathsToDelete = imagesToDelete.map((img) =>
          this.imageService.getPathFromUrl(img.url)
        );
        await this.imageService.deleteMultipleImages(pathsToDelete);

        // Eliminar registros de la base de datos
        const idsToDelete = imagesToDelete.map((img) => img.id);
        const { error: deleteError } = await this.supabaseClient
          .from('imagenes')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          throw deleteError;
        }
      }

      // Subir nuevas imágenes si las hay
      if (newImageFiles.length > 0) {
        // Preparar requests de subida
        const imageRequests: ImageUploadRequest[] = newImageFiles.map(
          (file) => ({
            file,
            filename: file.name,
          })
        );

        // Subir imágenes al Storage
        const uploadedImages = await this.imageService.uploadMultipleImages(
          imageRequests
        );

        // Guardar referencias en la base de datos
        const imageRecords = uploadedImages.map((uploadResult) => ({
          id_obra: id,
          url: uploadResult.url,
          nombre: uploadResult.filename,
          tamano:
            newImageFiles.find((f) => f.name === uploadResult.filename)?.size ||
            0,
        }));

        const { error: imagesError } = await this.supabaseClient
          .from('imagenes')
          .insert(imageRecords);

        if (imagesError) {
          // Si falla la inserción, eliminar los archivos subidos
          const pathsToDelete = uploadedImages.map((img) =>
            this.imageService.getPathFromUrl(img.url)
          );
          await this.imageService.deleteMultipleImages(pathsToDelete);
          throw imagesError;
        }
      }

      // Recargar la obra seleccionada
      await this.getArtworkById(id);

      return artworkRecord;
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        error: true,
      }));
      throw error;
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
    }
  }

  async deleteArtwork(id: number) {
    try {
      this.state.update((state) => ({
        ...state,
        loading: true,
        error: false,
      }));

      // Primero obtener todas las imágenes asociadas para eliminar los archivos
      const { data: images, error: imagesQueryError } =
        await this.supabaseClient
          .from('imagenes')
          .select('url')
          .eq('id_obra', id);

      if (imagesQueryError) {
        throw imagesQueryError;
      }

      // Eliminar archivos del Storage si existen imágenes
      if (images && images.length > 0) {
        const pathsToDelete = images.map((img) =>
          this.imageService.getPathFromUrl(img.url)
        );
        await this.imageService.deleteMultipleImages(pathsToDelete);
      }

      // Eliminar registros de imágenes de la base de datos
      const { error: imagesError } = await this.supabaseClient
        .from('imagenes')
        .delete()
        .eq('id_obra', id);

      if (imagesError) {
        throw imagesError;
      }

      // Finalmente eliminar la obra
      const { error: artworkError } = await this.supabaseClient
        .from('obras')
        .delete()
        .eq('id', id);

      if (artworkError) {
        throw artworkError;
      }

      // Recargar la lista
      await this.getAllArtworks();
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        error: true,
      }));
      throw error;
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
    }
  }

  // Método para eliminar una imagen específica
  async deleteSpecificImage(imageId: number, artworkId: number) {
    try {
      this.state.update((state) => ({
        ...state,
        loading: true,
        error: false,
      }));

      // Obtener la información de la imagen para eliminar el archivo del Storage
      const { data: imageData, error: imageQueryError } =
        await this.supabaseClient
          .from('imagenes')
          .select('url')
          .eq('id', imageId)
          .single();

      if (imageQueryError) {
        throw imageQueryError;
      }

      if (imageData) {
        // Eliminar archivo del Storage
        const filePath = this.imageService.getPathFromUrl(imageData.url);
        await this.imageService.deleteImage(filePath);
      }

      // Eliminar registro de la base de datos
      const { error: deleteError } = await this.supabaseClient
        .from('imagenes')
        .delete()
        .eq('id', imageId);

      if (deleteError) {
        throw deleteError;
      }

      // Recargar la obra específica
      await this.getArtworkById(artworkId);
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        error: true,
      }));
      throw error;
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
    }
  }

  // Método para agregar imágenes a una obra existente
  async addImagesToArtwork(artworkId: number, imageFiles: File[]) {
    try {
      this.state.update((state) => ({
        ...state,
        loading: true,
        error: false,
      }));

      // Preparar requests de subida
      const imageRequests: ImageUploadRequest[] = imageFiles.map((file) => ({
        file,
        filename: file.name,
      }));

      // Subir imágenes al Storage
      const uploadedImages = await this.imageService.uploadMultipleImages(
        imageRequests
      );

      // Guardar referencias en la base de datos
      const imageRecords = uploadedImages.map((uploadResult) => ({
        id_obra: artworkId,
        url: uploadResult.url,
        nombre: uploadResult.filename,
        tamano:
          imageFiles.find((f) => f.name === uploadResult.filename)?.size || 0,
      }));

      const { error: imagesError } = await this.supabaseClient
        .from('imagenes')
        .insert(imageRecords);

      if (imagesError) {
        // Si falla la inserción, eliminar los archivos subidos
        const pathsToDelete = uploadedImages.map((img) =>
          this.imageService.getPathFromUrl(img.url)
        );
        await this.imageService.deleteMultipleImages(pathsToDelete);
        throw imagesError;
      }

      // Recargar la obra específica
      await this.getArtworkById(artworkId);
    } catch (error) {
      this.state.update((state) => ({
        ...state,
        error: true,
      }));
      throw error;
    } finally {
      this.state.update((state) => ({
        ...state,
        loading: false,
      }));
    }
  }
}
