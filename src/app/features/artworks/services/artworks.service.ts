import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
  ArtworkImage,
  ImageUploadRequest,
} from '../../../shared/models/image.model';
import { ImageService } from '../../../shared/services/image.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Artwork,
  ArtworkCreateData,
  ArtworkState,
  PaginationParams,
} from '../../../shared/models/artwork.model';

/**
 * Columnas visibles para cualquier visitante.
 * Se excluyen a proposito `ubicacion`, `valor`, `bloque_asignado` y
 * `responsable_id`: juntas forman un mapa de que obra vale cuanto, donde esta
 * y quien la custodia.
 */
const COLUMNAS_PUBLICAS =
  'id, titulo, autor, tecnica, dimension, ano, observaciones, descripcion, fecha_creacion, fecha_actualizacion';

/** Los administradores ven la ficha completa. */
const COLUMNAS_ADMIN = '*';

/**
 * Columnas por las que puede filtrar un visitante anonimo.
 * Debe ser un subconjunto de COLUMNAS_PUBLICAS: filtrar por una columna oculta
 * permitiria deducir su valor por ensayo y error.
 */
const FILTROS_PUBLICOS = ['search', 'autor', 'tecnica'] as const;

@Injectable({
  providedIn: 'root',
})
export class ArtworksService {
  // Guardar filtros activos
  private activeFilters: Omit<PaginationParams, 'page' | 'limit'> | null = null;
  // Obtener todas las obras sin paginación (para exportar)
  async getAllArtworksNoPagination(): Promise<Artwork[]> {
    await this.supabaseService.ensureActiveSession();
    this.supabaseClient = this.supabaseService.supabaseClient;
    const { data, error } = await this.supabaseClient
      .from(this.tablaLectura())
      .select(`${this.selectColumns()}, imagenes(*)`)
      .returns<Artwork[]>();
    if (error) throw error;
    return data || [];
  }
  private supabaseService = inject(SupabaseService);
  private supabaseClient = this.supabaseService.supabaseClient;
  private imageService = inject(ImageService);
  private authService = inject(AuthService);

  private state = signal<ArtworkState>({
    artworks: [],
    selectedArtwork: null,
    loading: false,
    error: false,
    currentPage: 1,
    totalItems: 0,
    itemsPerPage: 24,
    totalPages: 0,
  });

  // Variable para evitar llamadas concurrentes
  private loadingPromise: Promise<any> | null = null;
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

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

  /**
   * Columnas a pedir segun el rol. La defensa real son los GRANT por columna
   * en Postgres; esto evita ademas que los datos sensibles viajen al
   * navegador de un visitante.
   */
  private selectColumns(): string {
    return this.authService.isAdmin() ? COLUMNAS_ADMIN : COLUMNAS_PUBLICAS;
  }

  /**
   * Relacion de la que leer. `authenticated` no tiene concedidas ubicacion,
   * valor, bloque_asignado ni responsable_id sobre la tabla `obras`, porque
   * los permisos por columna son por rol y un administrador tambien es
   * `authenticated`. Esas columnas solo las sirve la vista `obras_admin`, que
   * comprueba el rol dentro. Las escrituras siguen yendo contra `obras`.
   */
  private tablaLectura(): 'obras' | 'obras_admin' {
    return this.authService.isAdmin() ? 'obras_admin' : 'obras';
  }

  /** Descarta los filtros que un visitante anonimo no puede usar. */
  private sanitizeParams(params: PaginationParams): PaginationParams {
    if (this.authService.isAdmin()) return params;

    const permitido: PaginationParams = {
      page: params.page,
      limit: params.limit,
    };
    for (const clave of FILTROS_PUBLICOS) {
      if (params[clave] !== undefined) {
        permitido[clave] = params[clave] as any;
      }
    }
    return permitido;
  }

  /**
   * PostgREST interpreta `,`, `(` y `)` como estructura dentro de or=(...),
   * asi que un valor sin escapar permite inyectar condiciones arbitrarias.
   * Entrecomillar y escapar `\` y `"` deja el valor como dato literal.
   */
  private quoteFilterValue(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  /**
   * Garantiza sesion activa y refresca la referencia al cliente, que
   * SupabaseService puede haber sustituido con reinitializeClient().
   * Toda operacion de escritura debe llamarlo antes de tocar la base.
   */
  private async prepareClient(): Promise<void> {
    await this.supabaseService.ensureActiveSession();
    this.supabaseClient = this.supabaseService.supabaseClient;
  }

  async getAllArtworks(params: PaginationParams = {}) {
    // Una peticion en vuelo no puede descartar parametros nuevos: si cambian
    // la pagina o los filtros mientras carga, se cancela la anterior y se
    // lanza la nueva. Antes se devolvia la promesa antigua y el clic se perdia.
    if (this.loadingPromise && this.abortController) {
      this.abortController.abort();
    }

    // Si hay filtros activos y no se pasan filtros explícitos, usarlos
    let finalParams = { ...params };
    if (
      this.activeFilters &&
      !('search' in params) &&
      !('ubicacion' in params) &&
      !('responsable' in params) &&
      !('autor' in params) &&
      !('tecnica' in params)
    ) {
      finalParams = { ...this.activeFilters, ...params };
    }

    this.loadingPromise = this.doGetAllArtworks(this.sanitizeParams(finalParams));
    return this.loadingPromise;
  }

  private async doGetAllArtworks(params: PaginationParams = {}) {
    // Cancelar request anterior si existe
    if (this.abortController) {
      this.abortController.abort();
    }

    const controlador = new AbortController();
    this.abortController = controlador;

    // Pausar heartbeat durante el request para evitar interferencias
    this.supabaseService.pauseHeartbeat();

    let paginaFueraDeRango = false;
    try {
      // CRÍTICO: Verificar y garantizar que la sesión está activa antes de hacer el request
      const sessionActive = await this.supabaseService.ensureActiveSession();

      // Si el cliente fue reinicializado, actualizar referencia local
      this.supabaseClient = this.supabaseService.supabaseClient;

      if (!sessionActive) {
        console.warn('Session not active, attempting to refresh...');
        const refreshed = await this.supabaseService.refreshSession();

        if (!refreshed) {
          // Si tampoco se puede refrescar, reintentar referencia
          this.supabaseService.reinitializeClient();
          this.supabaseClient = this.supabaseService.supabaseClient;
          throw new Error('Could not establish active session');
        }

        // Esperar después de refrescar
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const page = params.page || this.state().currentPage;
      const limit = params.limit || this.state().itemsPerPage;
      const { search, ubicacion, responsable, autor, tecnica } = params;

      this.state.update((state) => ({
        ...state,
        loading: true,
        error: false, // Resetear error anterior
        currentPage: page,
      }));

      // Calcular el rango para la paginación
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit - 1;

      // Construir la consulta base con count estimado para mejor performance
      // `estimated` devolvia un conteo del planificador, asi que totalPages
      // podia ofrecer paginas vacias en consultas filtradas.
      let query = this.supabaseClient
        .from(this.tablaLectura())
        .select(`${this.selectColumns()}, imagenes(*)`, { count: 'exact' });

      // Aplicar filtros de búsqueda si existen (optimización: solo aplicar filtros no vacíos)
      const activeFilters = [];

      if (search?.trim()) {
        query = query.ilike('titulo', `%${search.trim()}%`);
        activeFilters.push('titulo');
      }

      // Filtro de ubicación: soporta una ubicación o múltiples ubicaciones
      if (ubicacion) {
        if (Array.isArray(ubicacion)) {
          // Múltiples ubicaciones: usar operador OR
          const ubicacionesValidas = ubicacion.filter((u) => u?.trim());
          if (ubicacionesValidas.length > 0) {
            const ubicacionConditions = ubicacionesValidas.map(
              (u) =>
                `ubicacion.ilike.${this.quoteFilterValue(`%${u.trim()}%`)}`
            );
            query = query.or(ubicacionConditions.join(','));
            activeFilters.push('ubicacion');
          }
        } else if (ubicacion.trim()) {
          // Una sola ubicación: usar ILIKE normal
          query = query.ilike('ubicacion', `%${ubicacion.trim()}%`);
          activeFilters.push('ubicacion');
        }
      }

      if (responsable?.trim()) {
        query = query.ilike('responsable', `%${responsable.trim()}%`);
        activeFilters.push('responsable');
      }

      if (autor?.trim()) {
        query = query.ilike('autor', `%${autor.trim()}%`);
        activeFilters.push('autor');
      }

      if (tecnica?.trim()) {
        query = query.ilike('tecnica', `%${tecnica.trim()}%`);
        activeFilters.push('tecnica');
      }

      // Aplicar paginación y orden
      const queryPromise = query
        .order('fecha_creacion', { ascending: false })
        .range(startIndex, endIndex)
        .abortSignal(controlador.signal)
        .returns<Artwork[]>();

      // Ejecutar la consulta con reintentos automáticos
      let retries = 0;
      const maxRetries = 2;
      let lastError: any = null;

      while (retries <= maxRetries) {
        try {
          const { data, error, count } = await queryPromise;

          if (error) {
            // Si es un error de cancelación, no lo tratamos como error real
            if (
              error.message?.includes('aborted') ||
              error.name === 'AbortError'
            ) {
              return;
            }

            // PostgREST responde 416 a un offset mayor que el total (una pagina guardada
            // cuando habia mas obras o paginas mas cortas). No es un fallo de red: no se reintenta.
            if (error.code === 'PGRST103' && page > 1) {
              paginaFueraDeRango = true;
              break;
            }

            // Si es un error de autenticación/sesión, intentar refrescar
            if (this.isAuthError(error)) {
              console.warn(
                'Authentication error detected, refreshing session...'
              );
              await this.supabaseService.refreshSession();
              await new Promise((resolve) => setTimeout(resolve, 1500));
              throw error; // Lanzar para activar el retry
            }

            throw error;
          }

          if (data) {
            const totalItems = count || 0;
            const totalPages = Math.ceil(totalItems / limit);

            // Ajustar página si es mayor que totalPages
            let adjustedPage = page;
            if (page > totalPages && totalPages > 0) {
              adjustedPage = totalPages;
            }

            this.state.update((state) => ({
              ...state,
              artworks: data,
              totalItems,
              totalPages,
              itemsPerPage: limit,
              currentPage: adjustedPage,
            }));

            // Marcar actividad exitosa
            this.supabaseService.markActivity();
          }

          // Éxito - salir del loop
          break;
        } catch (error: any) {
          lastError = error;
          // Detectar errores de red o estado inconsistente y reinicializar cliente Supabase
          if (!this.isAuthError(error)) {
            console.warn(
              'Network or connection error detected, reinitializing Supabase client...'
            );
            this.supabaseService.reinitializeClient();
            this.supabaseClient = this.supabaseService.supabaseClient;
          }

          // Ignorar errores de cancelación
          if (
            error?.message?.includes('aborted') ||
            error?.name === 'AbortError'
          ) {
            return;
          }

          retries++;
          if (retries <= maxRetries) {
            console.warn(
              `Request failed (attempt ${retries}/${
                maxRetries + 1
              }), retrying...`,
              error
            );

            // Si es un error de autenticación, esperar más tiempo
            const waitTime = this.isAuthError(lastError)
              ? 2000
              : 1000 * retries;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            // Último intento falló
            throw lastError;
          }
        }
      }
    } catch (error: any) {
      // Ignorar errores de cancelación
      if (error?.message?.includes('aborted') || error?.name === 'AbortError') {
        return;
      }

      console.error('Error loading artworks:', error);
      this.state.update((state) => ({
        ...state,
        error: true,
        artworks: [], // Limpiar datos en caso de error
      }));
    } finally {
      if (this.abortController === controlador) this.abortController = null;

      // Reanudar heartbeat
      this.supabaseService.resumeHeartbeat();

      this.state.update((state) => ({
        ...state,
        loading: false,
      }));

      this.loadingPromise = null;
    }

    if (paginaFueraDeRango) {
      await this.doGetAllArtworks({ ...params, page: 1 });
    }
  }

  // Método para resetear estado en caso de problemas
  resetLoadingState() {
    // Cancelar cualquier request pendiente
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.loadingPromise = null;

    this.state.update((state) => ({
      ...state,
      loading: false,
      error: false,
    }));
  }

  // Método para detectar errores de autenticación/sesión
  private isAuthError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    // Detectar errores comunes de autenticación/sesión
    return (
      errorMessage.includes('jwt') ||
      errorMessage.includes('token') ||
      errorMessage.includes('session') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorCode.includes('pgrst301') || // JWT expired
      errorCode.includes('pgrst302') || // Invalid JWT
      errorCode === '401'
    );
  }

  // Métodos de navegación de páginas
  async goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      await this.getAllArtworks({ page });
    }
  }

  // Métodos de búsqueda y filtrado
  async searchArtworks(searchTerm: string, page: number = 1) {
    await this.getAllArtworks({ search: searchTerm, page });
  }

  async filterArtworks(
    filters: Omit<PaginationParams, 'page' | 'limit'>,
    page: number = 1
  ) {
    this.activeFilters = filters;
    await this.getAllArtworks({ ...filters, page });
  }

  // Método para limpiar todos los filtros
  async clearAllFilters() {
    this.activeFilters = null;
    await this.getAllArtworks({
      search: '',
      ubicacion: '',
      responsable: '',
      autor: '',
      tecnica: '',
      page: 1,
    });
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
    // Pausar heartbeat durante el request
    this.supabaseService.pauseHeartbeat();

    try {
      // CRÍTICO: Verificar y garantizar que la sesión está activa
      const sessionActive = await this.supabaseService.ensureActiveSession();

      // Si el cliente fue reinicializado, actualizar referencia local
      this.supabaseClient = this.supabaseService.supabaseClient;

      if (!sessionActive) {
        console.warn('Session not active, attempting to refresh...');
        const refreshed = await this.supabaseService.refreshSession();

        if (!refreshed) {
          // Si tampoco se puede refrescar, reintentar referencia
          this.supabaseService.reinitializeClient();
          this.supabaseClient = this.supabaseService.supabaseClient;
          throw new Error('Could not establish active session');
        }

        // Esperar después de refrescar
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      this.state.update((state) => ({
        ...state,
        loading: true,
        selectedArtwork: null,
        error: false,
      }));

      // Ejecutar consulta con reintentos automáticos
      let retries = 0;
      const maxRetries = 2;
      let lastError: any = null;

      while (retries <= maxRetries) {
        try {
          const { data, error } = await this.supabaseClient
            .from(this.tablaLectura())
            .select(`${this.selectColumns()}, imagenes(*)`)
            .eq('id', id)
            .single()
            .returns<Artwork>();

          if (error) {
            // Si es un error de autenticación/sesión, intentar refrescar
            if (this.isAuthError(error)) {
              console.warn(
                'Authentication error detected, refreshing session...'
              );
              await this.supabaseService.refreshSession();
              await new Promise((resolve) => setTimeout(resolve, 1500));
              throw error; // Lanzar para activar el retry
            }

            throw error;
          }

          if (data) {
            this.state.update((state) => ({
              ...state,
              selectedArtwork: data,
            }));

            // Marcar actividad exitosa
            this.supabaseService.markActivity();
          }

          // Éxito - salir del loop
          break;
        } catch (error: any) {
          lastError = error;
          retries++;

          if (retries <= maxRetries) {
            console.warn(
              `Loading artwork failed (attempt ${retries}/${
                maxRetries + 1
              }), retrying...`,
              error
            );

            // Si es un error de autenticación, esperar más tiempo
            const waitTime = this.isAuthError(lastError)
              ? 2000
              : 1000 * retries;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            // Último intento falló
            throw lastError;
          }
        }
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
      // Reanudar heartbeat
      this.supabaseService.resumeHeartbeat();

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
      // Sesion viva y cliente al dia antes de escribir: reinitializeClient()
      // puede haber sustituido la instancia mientras la pestana estaba oculta.
      await this.prepareClient();

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
          .select('id')
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
      // Sesion viva y cliente al dia antes de escribir: reinitializeClient()
      // puede haber sustituido la instancia mientras la pestana estaba oculta.
      await this.prepareClient();

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
          .select('id')
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
      // Sesion viva y cliente al dia antes de escribir: reinitializeClient()
      // puede haber sustituido la instancia mientras la pestana estaba oculta.
      await this.prepareClient();

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
      // Sesion viva y cliente al dia antes de escribir: reinitializeClient()
      // puede haber sustituido la instancia mientras la pestana estaba oculta.
      await this.prepareClient();

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
      // Sesion viva y cliente al dia antes de escribir: reinitializeClient()
      // puede haber sustituido la instancia mientras la pestana estaba oculta.
      await this.prepareClient();

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
