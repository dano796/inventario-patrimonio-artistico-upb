import { ArtworksService } from '../../services/artworks.service';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  signal,
  OnDestroy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-artwork-list',
  imports: [CommonModule, RouterLink, ConfirmModalComponent, FormsModule],
  templateUrl: './artwork-list.html',
})
export class ArtworkListComponent implements AfterViewInit, OnDestroy {
  // Signal para mostrar loader durante la exportación
  isExporting = signal<boolean>(false);
  // Exportar todas las obras a Excel
  async exportArtworksToExcel() {
    this.isExporting.set(true);
    try {
      // Importaciones dinámicas para reducir el tamaño del bundle inicial y evitar errores de exportación
      const ExcelJS = (await import('exceljs')).default;
      const fileSaverModule = await import('file-saver');
      const saveAs = fileSaverModule.saveAs || fileSaverModule.default;

      const allArtworks =
        await this.artworksService.getAllArtworksNoPagination();
      if (!allArtworks || allArtworks.length === 0) {
        alert('No hay obras para exportar.');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Obras');

      // Definir columnas
      worksheet.columns = [
        { header: 'NÚMERO DE INVENTARIO', key: 'id', width: 15 },
        { header: 'AUTOR', key: 'autor', width: 20 },
        { header: 'TÍTULO', key: 'titulo', width: 20 },
        { header: 'TÉCNICA', key: 'tecnica', width: 18 },
        { header: 'DIMENSIONES (cm)', key: 'dimension', width: 15 },
        { header: 'AÑO DE ELABORACIÓN', key: 'ano', width: 15 },
        { header: 'UBICACIÓN', key: 'ubicacion', width: 30 },
        { header: 'VALOR', key: 'valor', width: 15 },
        { header: 'OBSERVACIONES', key: 'observaciones', width: 30 },
        { header: 'RESPONSABLE', key: 'responsable', width: 20 },
        { header: 'IMAGEN 1', key: 'imagen1', width: 20 },
        { header: 'IMAGEN 2', key: 'imagen2', width: 20 },
        { header: 'IMAGEN 3', key: 'imagen3', width: 20 },
      ];

      // Agregar filas (sin imagen aún)
      allArtworks.forEach((obra: any, idx: number) => {
        const row = worksheet.addRow({
          id: obra.id,
          autor: obra.autor ?? '',
          titulo: obra.titulo ?? '',
          tecnica: obra.tecnica ?? '',
          dimension: obra.dimension ?? '',
          ano: obra.ano ?? '',
          ubicacion: obra.ubicacion ?? '',
          valor: obra.valor ? parseFloat(obra.valor) : '',
          observaciones: obra.observaciones ?? '',
          responsable: obra.responsable ?? '',
          imagen1: '',
          imagen2: '',
          imagen3: '',
        });
        // Estilos de fila
        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10 };
          cell.alignment = {
            vertical: 'middle',
            wrapText: true,
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
        // Aplicar formato de moneda sin decimales a la columna de valor
        const valorCell = row.getCell(8);
        if (obra.valor) {
          valorCell.numFmt = '"$"#,##0';
        }
        // Ajustar el alto de la fila para las imágenes
        worksheet.getRow(idx + 2).height = 90;
      });

      // Estilos de header
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = {
          name: 'Arial',
          size: 10,
          color: { argb: 'FF632523' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2DCDB' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Ajustar el alto del header
      worksheet.getRow(1).height = 60;

      // Descargar e insertar hasta 3 imágenes por obra
      for (let i = 0; i < allArtworks.length; i++) {
        const obra = allArtworks[i];
        if (obra.imagenes && obra.imagenes.length > 0) {
          for (let j = 0; j < Math.min(3, obra.imagenes.length); j++) {
            const img = obra.imagenes[j];
            if (img && img.url) {
              try {
                const imageUrl = img.url;
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const extension = imageUrl.split('.').pop()?.toLowerCase();
                let imageType: 'jpeg' | 'png' = 'jpeg';
                if (extension === 'png') imageType = 'png';
                const imageId = workbook.addImage({
                  buffer: new Uint8Array(arrayBuffer) as any,
                  extension: imageType,
                });
                // Obtener tamaño real de la imagen
                const imgBitmap = await createImageBitmap(blob);
                const maxCellWidthPx = 133;
                const maxCellHeightPx = 125;
                let drawWidth = imgBitmap.width;
                let drawHeight = imgBitmap.height;

                // Escalar proporcionalmente para que la imagen nunca exceda la altura disponible
                const targetRow = worksheet.getRow(i + 2);
                const defaultRowHeightPoints = 90;
                const existingHeightPoints = (targetRow.height ??
                  defaultRowHeightPoints) as number;
                // Conversión aproximada: 1px ≈ 0.75pt
                const pxToPt = 0.75;
                const existingHeightPx = Math.floor(
                  existingHeightPoints / pxToPt
                );
                const paddingPx = 24; // padding vertical conservador
                // No usar más altura que el máximo teórico
                const availableHeightPx = Math.max(
                  1,
                  Math.min(maxCellHeightPx, existingHeightPx - paddingPx)
                );

                const widthRatio = maxCellWidthPx / drawWidth;
                const heightRatio = availableHeightPx / drawHeight;
                const scale = Math.min(1, widthRatio, heightRatio);

                drawWidth = Math.round(drawWidth * scale);
                drawHeight = Math.round(drawHeight * scale);

                // Clamp de seguridad final
                if (drawWidth > maxCellWidthPx) drawWidth = maxCellWidthPx;
                if (drawHeight > availableHeightPx)
                  drawHeight = availableHeightPx;

                worksheet.addImage(imageId, {
                  tl: { col: 10 + j, row: i + 1 } as any,
                  ext: { width: drawWidth, height: drawHeight },
                  editAs: 'oneCell',
                });
              } catch (imgErr) {
                // Si falla la imagen, dejar celda vacía
              }
            }
          }
        }
      }

      // Descargar el archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, 'inventario-obras.xlsx');
    } catch (error: any) {
      alert('Error exportando a Excel: ' + (error?.message || error));
    } finally {
      this.isExporting.set(false);
    }
  }
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private artworksService = inject(ArtworksService);

  // Subject para manejar la destrucción del componente
  private destroy$ = new Subject<void>();

  // Subjects para filtros con debounce
  private searchSubject = new Subject<string>();
  private ubicacionSubject = new Subject<string>();
  private responsableSubject = new Subject<string>();
  private autorSubject = new Subject<string>();
  private tecnicaSubject = new Subject<string>();

  // Usar directamente el AuthService optimizado
  isAuthenticated = this.authService.isAuthenticated;
  isAdmin = this.authService.isAdmin;
  isAuthLoading = this.authService.isLoading;

  // Signals para el modal de confirmación
  isModalOpen = signal(false);
  private artworkToDelete = signal<number | null>(null);
  isDeleting = signal(false);
  deleteError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Signal para manejar índices de imágenes de cada obra
  private imageIndices = signal<Record<number, number>>({});

  // Signal para detectar si la página estaba oculta
  private wasPageHidden = signal<boolean>(false);
  private lastVisibilityChange = signal<number>(Date.now());

  // Bandera para evitar múltiples intentos de recuperación simultáneos
  private isRecovering = signal<boolean>(false);

  // Signals para filtros
  searchTerm = signal<string>('');
  ubicacionFilter = signal<string>('');
  selectedUbicaciones = signal<string[]>([]); // Nueva signal para múltiples ubicaciones
  responsableFilter = signal<string>('');
  autorFilter = signal<string>('');
  tecnicaFilter = signal<string>('');

  // Signal para controlar la visibilidad de filtros avanzados
  showAdvancedFilters = signal<boolean>(false);

  // Signal para el número de columnas en la grid
  selectedColumns = signal<number>(3);

  // Clave para localStorage
  private readonly FILTERS_STORAGE_KEY = 'artwork-filters';

  // Página guardada en localStorage
  private savedPage = signal<number>(1);

  // Computed para saber si hay filtros activos
  hasActiveFilters = computed(() => {
    return (
      this.searchTerm() !== '' ||
      this.ubicacionFilter() !== '' ||
      this.selectedUbicaciones().length > 0 ||
      this.responsableFilter() !== '' ||
      this.autorFilter() !== '' ||
      this.tecnicaFilter() !== ''
    );
  });

  // Computed para contar filtros activos
  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.searchTerm()) count++;
    if (this.ubicacionFilter()) count++;
    if (this.selectedUbicaciones().length > 0) count++;
    if (this.responsableFilter()) count++;
    if (this.autorFilter()) count++;
    if (this.tecnicaFilter()) count++;
    return count;
  });

  // Computed properties del servicio
  artworks = this.artworksService.artworks;
  isLoading = this.artworksService.loading;
  error = this.artworksService.error;

  // Computed properties de paginación
  currentPage = this.artworksService.currentPage;
  totalItems = this.artworksService.totalItems;
  totalPages = this.artworksService.totalPages;
  startItem = this.artworksService.startItem;
  endItem = this.artworksService.endItem;
  hasPreviousPage = this.artworksService.hasPreviousPage;
  hasNextPage = this.artworksService.hasNextPage;

  constructor() {
    // AuthService maneja automáticamente la autenticación
    this.setupFilters();
    this.listenToQueryParams();
    this.setupErrorRecovery();
    this.setupPageVisibilityHandler();
  }

  // Sistema de recuperación de errores - simplificado y menos agresivo
  private setupErrorRecovery() {
    // Monitorear estado de loading para detectar problemas
    let loadingTimeoutId: NodeJS.Timeout | null = null;
    let rescueTimeoutId: NodeJS.Timeout | null = null;

    effect(() => {
      const loading = this.isLoading();

      if (loading) {
        // Timeout de rescate rápido tras inactividad o reinicio de sesión
        rescueTimeoutId = setTimeout(() => {
          if (this.isLoading()) {
            console.warn(
              'Rescue timeout: Forcing reset and reload after 30s stuck loading'
            );
            this.artworksService.resetLoadingState();
            this.artworksService.getAllArtworks({ page: this.currentPage() });
          }
        }, 30000); // 30 segundos

        // Timeout de seguridad MUY largo (último recurso)
        loadingTimeoutId = setTimeout(() => {
          console.warn('Detected very long loading - attempting recovery');
          this.recoverFromLoadingError();
        }, 120000); // 2 minutos
      } else {
        // Si terminó de cargar, limpiar timeouts
        if (loadingTimeoutId) {
          clearTimeout(loadingTimeoutId);
          loadingTimeoutId = null;
        }
        if (rescueTimeoutId) {
          clearTimeout(rescueTimeoutId);
          rescueTimeoutId = null;
        }
      }
    });
  }

  private setupPageVisibilityHandler() {
    // Detectar cuando la página vuelve a estar visible después de estar oculta
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        // La página se ocultó
        this.wasPageHidden.set(true);
        this.lastVisibilityChange.set(Date.now());
      } else {
        // La página volvió a estar visible
        const hiddenTime = Date.now() - this.lastVisibilityChange();
        const hiddenSeconds = Math.round(hiddenTime / 1000);

        // Evitar múltiples intentos si ya está recuperando
        if (this.isRecovering()) {
          this.wasPageHidden.set(false);
          return;
        }

        // Si estuvo oculta por más de 2 minutos, hacer recuperación preventiva
        if (this.wasPageHidden() && hiddenTime > 2 * 60 * 1000) {
          // Marcar que estamos recuperando
          this.isRecovering.set(true);

          try {
            // 1. Cancelar cualquier request pendiente
            this.artworksService.resetLoadingState();

            // 2. El servicio ahora maneja automáticamente la verificación de sesión
            // antes de cada request, así que solo necesitamos recargar los datos
            if (this.hasActiveFilters()) {
              const ubicacionFilter =
                this.selectedUbicaciones().length > 0
                  ? this.selectedUbicaciones()
                  : this.ubicacionFilter();

              await this.artworksService.filterArtworks(
                {
                  search: this.searchTerm(),
                  ubicacion: ubicacionFilter,
                  responsable: this.responsableFilter(),
                  autor: this.autorFilter(),
                  tecnica: this.tecnicaFilter(),
                },
                this.currentPage()
              );
            } else {
              await this.artworksService.getAllArtworks({
                page: this.currentPage(),
              });
            }
          } catch (error) {
            console.error('Error during preventive recovery:', error);

            // Si falla, intentar una vez más después de una espera más larga
            await new Promise((resolve) => setTimeout(resolve, 3000));

            try {
              await this.artworksService.getAllArtworks({
                page: this.currentPage(),
              });
            } catch (retryError) {
              console.error('Retry also failed:', retryError);
              // El servicio ya maneja los errores y los muestra al usuario
            }
          } finally {
            this.isRecovering.set(false);
          }
        }

        this.wasPageHidden.set(false);
      }
    });
  }

  private async handleStaleConnection() {
    // Este método ya no es necesario con el nuevo sistema de recuperación
    // Mantener por compatibilidad pero simplificado
    await this.recoverFromLoadingError();
  }

  private async recoverFromLoadingError() {
    // Evitar múltiples intentos simultáneos
    if (this.isRecovering()) {
      return;
    }

    this.isRecovering.set(true);

    try {
      // 1. Resetear estado de artworks service
      this.artworksService.resetLoadingState();

      // 2. Refrescar sesión de Supabase
      try {
        await this.authService.supabaseService.refreshSession();
      } catch (error) {
        console.warn('Session refresh failed:', error);
      }

      // 3. Esperar para que la conexión se estabilice
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 4. Recargar datos con un solo intento (no múltiples reintentos)
      try {
        if (this.hasActiveFilters()) {
          const ubicacionFilter =
            this.selectedUbicaciones().length > 0
              ? this.selectedUbicaciones()
              : this.ubicacionFilter();

          await this.artworksService.filterArtworks(
            {
              search: this.searchTerm(),
              ubicacion: ubicacionFilter,
              responsable: this.responsableFilter(),
              autor: this.autorFilter(),
              tecnica: this.tecnicaFilter(),
            },
            this.currentPage()
          );
        } else {
          await this.artworksService.getAllArtworks();
        }
      } catch (error) {
        console.error('Recovery failed:', error);
      }
    } finally {
      // Siempre resetear la bandera al finalizar
      this.isRecovering.set(false);
    }
  }

  private async retryLoadArtworks(attempts: number = 2): Promise<void> {
    // Simplificado: solo 2 intentos en lugar de 3
    for (let i = 0; i < attempts; i++) {
      try {
        if (this.hasActiveFilters()) {
          const ubicacionFilter =
            this.selectedUbicaciones().length > 0
              ? this.selectedUbicaciones()
              : this.ubicacionFilter();

          await this.artworksService.filterArtworks(
            {
              search: this.searchTerm(),
              ubicacion: ubicacionFilter,
              responsable: this.responsableFilter(),
              autor: this.autorFilter(),
              tecnica: this.tecnicaFilter(),
            },
            this.currentPage()
          );
        } else {
          await this.artworksService.getAllArtworks();
        }

        return;
      } catch (error) {
        console.warn(`Retry attempt ${i + 1} failed:`, error);
        if (i < attempts - 1) {
          // Espera más corta entre intentos
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
    throw new Error('All retry attempts failed');
  }

  // Métodos para persistencia de filtros
  private saveFiltersToStorage() {
    const filters = {
      searchTerm: this.searchTerm(),
      ubicacionFilter: this.ubicacionFilter(),
      selectedUbicaciones: this.selectedUbicaciones(),
      responsableFilter: this.responsableFilter(),
      autorFilter: this.autorFilter(),
      tecnicaFilter: this.tecnicaFilter(),
      selectedColumns: this.selectedColumns(),
      currentPage: this.currentPage(),
      showAdvancedFilters: this.showAdvancedFilters(),
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(this.FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn(
        'No se pudieron guardar los filtros en localStorage:',
        error
      );
    }
  }

  private loadFiltersFromStorage(): boolean {
    try {
      const saved = localStorage.getItem(this.FILTERS_STORAGE_KEY);
      if (!saved) return false;

      const filters = JSON.parse(saved);

      // Verificar que no sea muy antiguo (24 horas)
      const isExpired = Date.now() - filters.timestamp > 24 * 60 * 60 * 1000;
      if (isExpired) {
        localStorage.removeItem(this.FILTERS_STORAGE_KEY);
        return false;
      }

      // Restaurar filtros sin triggear búsquedas
      this.searchTerm.set(filters.searchTerm || '');
      this.ubicacionFilter.set(filters.ubicacionFilter || '');
      this.selectedUbicaciones.set(filters.selectedUbicaciones || []);
      this.responsableFilter.set(filters.responsableFilter || '');
      this.autorFilter.set(filters.autorFilter || '');
      this.tecnicaFilter.set(filters.tecnicaFilter || '');
      this.selectedColumns.set(filters.selectedColumns || 3);
      this.showAdvancedFilters.set(filters.showAdvancedFilters || false);
      this.savedPage.set(filters.currentPage || 1);

      return true;
    } catch (error) {
      console.warn('Error al cargar filtros desde localStorage:', error);
      localStorage.removeItem(this.FILTERS_STORAGE_KEY);
      return false;
    }
  }

  private clearFiltersFromStorage() {
    try {
      localStorage.removeItem(this.FILTERS_STORAGE_KEY);
    } catch (error) {
      console.warn('Error al limpiar filtros de localStorage:', error);
    }
  }

  private setupFilters() {
    // Configurar búsqueda con debounce para cada filtro
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (searchTerm) => {
        this.searchTerm.set(searchTerm);
        await this.performFilters();
      });

    this.ubicacionSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (ubicacion) => {
        this.ubicacionFilter.set(ubicacion);
        await this.performFilters();
      });

    this.responsableSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (responsable) => {
        this.responsableFilter.set(responsable);
        await this.performFilters();
      });

    this.autorSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (autor) => {
        this.autorFilter.set(autor);
        await this.performFilters();
      });

    this.tecnicaSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (tecnica) => {
        this.tecnicaFilter.set(tecnica);
        await this.performFilters();
      });
  }

  private isInitialized = signal(false);

  private listenToQueryParams() {
    // Escuchar cambios en query parameters
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (params) => {
        const hasQueryParams = Object.keys(params).some((key) => params[key]);

        // Si no hay query params, intentar cargar desde localStorage
        if (!hasQueryParams && !this.isInitialized()) {
          const loadedFromStorage = this.loadFiltersFromStorage();
          if (loadedFromStorage) {
            // Aplicar filtros cargados desde localStorage
            await this.performFiltersWithoutUrlUpdate();
            this.isInitialized.set(true);
            return;
          }
        }

        const search = params['search'] || '';
        const ubicacion = params['ubicacion'] || '';
        const ubicaciones = params['ubicaciones']
          ? params['ubicaciones'].split(',')
          : [];
        const responsable = params['responsable'] || '';
        const autor = params['autor'] || '';
        const tecnica = params['tecnica'] || '';

        // Establecer valores sin triggear búsqueda
        this.searchTerm.set(search);
        this.ubicacionFilter.set(ubicacion);
        this.selectedUbicaciones.set(ubicaciones);
        this.responsableFilter.set(responsable);
        this.autorFilter.set(autor);
        this.tecnicaFilter.set(tecnica);

        // Solo cargar datos una vez al inicializar o si hay cambios reales
        if (!this.isInitialized()) {
          this.isInitialized.set(true);

          // Preparar filtros con ubicaciones múltiples
          const filterUbicacion =
            ubicaciones.length > 0 ? ubicaciones : ubicacion;

          // Cargar datos con filtros iniciales
          if (search || filterUbicacion || responsable || autor || tecnica) {
            await this.artworksService.filterArtworks(
              {
                search,
                ubicacion: filterUbicacion,
                responsable,
                autor,
                tecnica,
              },
              1
            );
          } else {
            await this.artworksService.getAllArtworks();
          }
        }
      });
  }

  async onLogout() {
    await this.authService.signOut();
    this.router.navigateByUrl('/autenticacion/iniciar-sesion');
  }

  viewArtworkDetails(id: number) {
    this.router.navigateByUrl(`/obra/${id}`);
  }

  onDeleteArtwork(id: number) {
    this.artworkToDelete.set(id);
    this.deleteError.set(null);
    this.isModalOpen.set(true);
  }

  async handleConfirmation(confirmed: boolean) {
    if (confirmed && this.artworkToDelete()) {
      this.isDeleting.set(true);
      this.deleteError.set(null);

      try {
        await this.artworksService.deleteArtwork(this.artworkToDelete()!);

        // Mostrar mensaje de éxito
        this.successMessage.set('Obra eliminada exitosamente');

        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
          this.successMessage.set(null);
        }, 3000);
      } catch (error) {
        console.error('Error al eliminar obra:', error);
        this.deleteError.set(
          'Error al eliminar la obra. Por favor, intente nuevamente.'
        );
        // No cerrar el modal si hay error, mostrar el mensaje
        this.isDeleting.set(false);
        return;
      }
    }

    // Cerrar modal y limpiar estado
    this.isModalOpen.set(false);
    this.artworkToDelete.set(null);
    this.isDeleting.set(false);
    this.deleteError.set(null);
  }

  ngAfterViewInit(): void {
    // Ya no necesario - la carga se hace en listenToQueryParams
    // Esto evita cargas duplicadas que causaban lentitud
  }

  // Métodos para manejar el carrusel de imágenes
  getCurrentImage(artwork: any) {
    if (!artwork.imagenes || artwork.imagenes.length === 0) {
      return null;
    }
    const currentIndex = this.getCurrentImageIndex(artwork.id);
    return artwork.imagenes[currentIndex];
  }

  getCurrentImageIndex(artworkId: number): number {
    return this.imageIndices()[artworkId] || 0;
  }

  nextImage(artworkId: number): void {
    const artwork = this.artworks().find((a) => a.id === artworkId);
    if (!artwork?.imagenes || artwork.imagenes.length <= 1) return;

    const currentIndex = this.getCurrentImageIndex(artworkId);
    const nextIndex = (currentIndex + 1) % artwork.imagenes.length;

    this.imageIndices.update((indices) => ({
      ...indices,
      [artworkId]: nextIndex,
    }));
  }

  prevImage(artworkId: number): void {
    const artwork = this.artworks().find((a) => a.id === artworkId);
    if (!artwork?.imagenes || artwork.imagenes.length <= 1) return;

    const currentIndex = this.getCurrentImageIndex(artworkId);
    const prevIndex =
      currentIndex === 0 ? artwork.imagenes.length - 1 : currentIndex - 1;

    this.imageIndices.update((indices) => ({
      ...indices,
      [artworkId]: prevIndex,
    }));
  }

  // Métodos de navegación de páginas
  async goToPage(page: number) {
    await this.artworksService.goToPage(page);
    this.savedPage.set(this.currentPage());
    this.saveFiltersToStorage();
  }

  async nextPage() {
    await this.artworksService.nextPage();
    this.savedPage.set(this.currentPage());
    this.saveFiltersToStorage();
  }

  async previousPage() {
    await this.artworksService.previousPage();
    this.savedPage.set(this.currentPage());
    this.saveFiltersToStorage();
  }

  async firstPage() {
    await this.artworksService.firstPage();
    this.savedPage.set(this.currentPage());
    this.saveFiltersToStorage();
  }

  async lastPage() {
    await this.artworksService.lastPage();
    this.savedPage.set(this.currentPage());
    this.saveFiltersToStorage();
  }

  // Generar array de números de página para mostrar
  getPageNumbers(): number[] {
    const totalPages = this.totalPages();
    const currentPage = this.currentPage();
    const pageNumbers: number[] = [];

    // Mostrar máximo 5 páginas
    const maxPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);

    // Ajustar si estamos cerca del final
    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return pageNumbers;
  }

  // Navegación avanzada
  async goToSpecificPage(page: number) {
    if (this.artworksService.isValidPageNumber(page)) {
      await this.artworksService.goToPage(page);
      this.savedPage.set(this.currentPage());
      this.saveFiltersToStorage();
    }
  }

  async goToFirstPage() {
    await this.artworksService.goToFirstPage();
  }

  async goToLastPage() {
    await this.artworksService.goToLastPage();
  }

  // Manejar input de página específica
  async onPageInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const page = parseInt(input.value);

    if (this.artworksService.isValidPageNumber(page)) {
      await this.goToSpecificPage(page);
    } else if (input.value !== '') {
      // Resetear a página actual si el número no es válido
      input.value = this.currentPage().toString();
    }
  }

  // Obtener rango de páginas para mostrar
  get pageRange() {
    return this.artworksService.getPageRange();
  }

  // Variable para evitar múltiples llamadas simultáneas
  private filteringInProgress = signal(false);

  // Métodos de búsqueda y filtrado
  async performFilters() {
    // Evitar múltiples llamadas simultáneas
    if (this.filteringInProgress()) {
      return;
    }

    this.filteringInProgress.set(true);

    try {
      // Usar ubicaciones múltiples si están disponibles, sino usar filtro individual
      const ubicacionFilter =
        this.selectedUbicaciones().length > 0
          ? this.selectedUbicaciones()
          : this.ubicacionFilter();

      const filters = {
        search: this.searchTerm(),
        ubicacion: ubicacionFilter,
        responsable: this.responsableFilter(),
        autor: this.autorFilter(),
        tecnica: this.tecnicaFilter(),
      };

      // Actualizar URL con query parameters
      const queryParams: any = {};
      queryParams.search = filters.search || null;
      queryParams.responsable = filters.responsable || null;
      queryParams.autor = filters.autor || null;
      queryParams.tecnica = filters.tecnica || null;

      // Manejar ubicaciones múltiples en URL
      if (Array.isArray(ubicacionFilter) && ubicacionFilter.length > 0) {
        queryParams.ubicaciones = ubicacionFilter.join(',');
        queryParams.ubicacion = null;
      } else if (typeof ubicacionFilter === 'string' && ubicacionFilter) {
        queryParams.ubicacion = ubicacionFilter;
        queryParams.ubicaciones = null;
      } else {
        queryParams.ubicacion = null;
        queryParams.ubicaciones = null;
      }
      queryParams.page = null; // Reset página

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        queryParamsHandling: 'merge',
      });

      // Realizar filtrado
      await this.artworksService.filterArtworks(filters, 1);

      // Guardar filtros en localStorage después de una búsqueda exitosa
      this.saveFiltersToStorage();
    } finally {
      this.filteringInProgress.set(false);
    }
  }

  // Método para realizar filtros sin actualizar URL (usado al cargar desde localStorage)
  async performFiltersWithoutUrlUpdate() {
    if (this.filteringInProgress()) {
      return;
    }

    this.filteringInProgress.set(true);

    try {
      const ubicacionFilter =
        this.selectedUbicaciones().length > 0
          ? this.selectedUbicaciones()
          : this.ubicacionFilter();

      const filters = {
        search: this.searchTerm(),
        ubicacion: ubicacionFilter,
        responsable: this.responsableFilter(),
        autor: this.autorFilter(),
        tecnica: this.tecnicaFilter(),
      };

      // Solo realizar filtrado, sin actualizar URL
      await this.artworksService.filterArtworks(filters, this.savedPage());

      // Actualizar savedPage con la página actual (puede haber sido ajustada)
      this.savedPage.set(this.currentPage());
      this.saveFiltersToStorage();
    } finally {
      this.filteringInProgress.set(false);
    }
  }

  async performSearch(searchTerm: string) {
    // Actualizar URL con query parameters
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: searchTerm || null, page: null },
      queryParamsHandling: 'merge',
    });

    // Realizar búsqueda
    await this.artworksService.searchArtworks(searchTerm, 1);
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  onUbicacionInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.ubicacionSubject.next(input.value);
  }

  onResponsableInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.responsableSubject.next(input.value);
  }

  onAutorInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.autorSubject.next(input.value);
  }

  onTecnicaInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tecnicaSubject.next(input.value);
  }

  async clearAllFilters() {
    // Limpiar todos los signals
    this.searchTerm.set('');
    this.ubicacionFilter.set('');
    this.selectedUbicaciones.set([]);
    this.responsableFilter.set('');
    this.autorFilter.set('');
    this.tecnicaFilter.set('');
    this.selectedColumns.set(3);

    // Limpiar localStorage
    this.clearFiltersFromStorage();

    // Limpiar URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: null,
        ubicacion: null,
        ubicaciones: null,
        responsable: null,
        autor: null,
        tecnica: null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });

    // Cargar sin filtros
    await this.artworksService.clearAllFilters();
  }

  async clearSearch() {
    this.searchTerm.set('');
    await this.performFilters();
  }

  async clearFilter(filterType: string) {
    switch (filterType) {
      case 'ubicacion':
        this.ubicacionFilter.set('');
        this.selectedUbicaciones.set([]);
        break;
      case 'responsable':
        this.responsableFilter.set('');
        break;
      case 'autor':
        this.autorFilter.set('');
        break;
      case 'tecnica':
        this.tecnicaFilter.set('');
        break;
    }
    await this.performFilters();
  }

  // Métodos para manejar múltiples ubicaciones
  toggleAdvancedFilters() {
    this.showAdvancedFilters.update((show) => !show);
  }

  addUbicacion() {
    const ubicacion = this.ubicacionFilter().trim();
    if (ubicacion && !this.selectedUbicaciones().includes(ubicacion)) {
      this.selectedUbicaciones.update((ubicaciones) => [
        ...ubicaciones,
        ubicacion,
      ]);
      this.ubicacionFilter.set('');
      this.performFilters();
    }
  }

  removeUbicacion(ubicacion: string) {
    this.selectedUbicaciones.update((ubicaciones) =>
      ubicaciones.filter((u) => u !== ubicacion)
    );
    this.performFilters();
  }

  onUbicacionKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addUbicacion();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDeleteConfirmMessage(): string {
    const artworkId = this.artworkToDelete();
    if (artworkId) {
      const artwork = this.artworks().find((a) => a.id === artworkId);
      if (artwork?.titulo) {
        return `¿Está seguro de que desea eliminar la obra "${artwork.titulo}"?`;
      }
    }
    return '¿Está seguro de que desea eliminar esta obra de arte?';
  }

  // Método para obtener las clases de la grid basadas en el número de columnas seleccionado
  getGridClasses(): string {
    const cols = this.selectedColumns();
    return `grid grid-cols-1 md:grid-cols-${cols} gap-6`;
  }

  // Método para cambiar el número de columnas
  changeColumns(columns: number) {
    this.selectedColumns.set(columns);
    this.saveFiltersToStorage();
  }

  // Método para manejar el cambio en el selector de columnas
  onColumnsChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.changeColumns(parseInt(select.value));
  }
}
