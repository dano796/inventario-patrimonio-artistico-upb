import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, filter, Subject, takeUntil } from 'rxjs';
import { ArtworksService } from '../../services/artworks.service';
import { ArtworkExportService } from '../../services/artwork-export.service';
import { AuthService } from '../../../../core/services/auth.service';
import { borrarAlmacen, guardarAlmacen, leerAlmacen } from '../../../../shared/utils/almacen';
import { DatoFaltante, esDatoFaltante } from '../../../../shared/models/artwork.model';
import {
  ChipFiltro, ClaveChip, ClaveFiltro, chipsFiltros, guardarVista,
  leerVista, lineaResultado, tamanoPagina, ValoresFiltros, Vista,
} from '../../utils/galeria';
import { BarraFiltrosComponent } from '../galeria/barra-filtros/barra-filtros.component';
import { TarjetaObraComponent } from '../galeria/tarjeta-obra/tarjeta-obra.component';
import { TablaObrasComponent } from '../galeria/tabla-obras/tabla-obras.component';
import { PaginacionComponent } from '../galeria/paginacion/paginacion.component';

@Component({
  selector: 'app-artwork-list',
  imports: [RouterLink, BarraFiltrosComponent, TarjetaObraComponent, TablaObrasComponent, PaginacionComponent],
  templateUrl: './artwork-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkListComponent implements OnDestroy {
  private exportService = inject(ArtworkExportService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private artworksService = inject(ArtworksService);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private ubicacionSubject = new Subject<string>();
  private responsableSubject = new Subject<string>();
  private autorSubject = new Subject<string>();
  private tecnicaSubject = new Subject<string>();

  isAdmin = this.authService.isAdmin;

  isExporting = signal(false);
  exportError = signal<string | null>(null);

  searchTerm = signal('');
  ubicacionFilter = signal('');
  selectedUbicaciones = signal<string[]>([]);
  responsableFilter = signal('');
  autorFilter = signal('');
  tecnicaFilter = signal('');
  faltaFilter = signal<DatoFaltante | ''>('');
  showAdvancedFilters = signal(false);

  readonly vistas: readonly { valor: Vista; etiqueta: string }[] = [
    { valor: 'galeria', etiqueta: 'Galería' },
    { valor: 'mosaico', etiqueta: 'Mosaico' },
    { valor: 'tabla', etiqueta: 'Tabla' },
  ];
  vista = signal<Vista>(leerVista());

  private readonly FILTERS_STORAGE_KEY = 'artwork-filters';
  private savedPage = signal(1);
  private isInitialized = signal(false);
  private filteringInProgress = signal(false);
  private filtroPendiente = false;

  artworks = this.artworksService.artworks;
  isLoading = this.artworksService.loading;
  error = this.artworksService.error;
  currentPage = this.artworksService.currentPage;
  totalItems = this.artworksService.totalItems;
  totalPages = this.artworksService.totalPages;

  valoresFiltros = computed<ValoresFiltros>(() => ({
    busqueda: this.searchTerm(),
    ubicacion: this.ubicacionFilter(),
    ubicaciones: this.selectedUbicaciones(),
    responsable: this.responsableFilter(),
    autor: this.autorFilter(),
    tecnica: this.tecnicaFilter(),
    falta: this.faltaFilter(),
  }));
  chips = computed(() => chipsFiltros(this.valoresFiltros(), this.isAdmin()));
  linea = computed(() => lineaResultado(this.totalItems(), this.chips()));

  constructor() {
    this.artworksService.fijarTamanoPagina(tamanoPagina(this.vista()));
    this.setupFilters();
    // Hasta que el perfil carga, isAdmin() es false: la primera lectura saldria de `obras`, sin las
    // columnas restringidas, y los filtros de ubicacion y responsable guardados se descartarian.
    this.authService.listo().then(() => this.listenToQueryParams());
  }


  // Cada cosa tiene un unico responsable: InactivityService la sesion,
  // ArtworksService los reintentos, y este componente solo presenta.

  async exportArtworksToExcel() {
    this.isExporting.set(true);
    this.exportError.set(null);
    try {
      const total = await this.exportService.exportToExcel(this.filtrosActuales());
      if (total === 0) this.exportError.set('No hay obras para exportar.');
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      this.exportError.set('No se pudo generar el archivo de Excel. Intenta de nuevo.');
    } finally {
      this.isExporting.set(false);
    }
  }

  async cambiarVista(vista: Vista): Promise<void> {
    this.vista.set(vista);
    guardarVista(vista);
    await this.artworksService.cambiarTamanoPagina(tamanoPagina(vista));
    this.savedPage.set(this.currentPage());
    this.saveFiltersToStorage();
  }

  onCambioFiltro({ clave, valor }: { clave: ClaveFiltro; valor: string }): void {
    const destino: Record<ClaveFiltro, Subject<string>> = {
      busqueda: this.searchSubject,
      ubicacion: this.ubicacionSubject,
      responsable: this.responsableSubject,
      autor: this.autorSubject,
      tecnica: this.tecnicaSubject,
    };
    destino[clave].next(valor);
  }

  async onQuitarChip(chip: ChipFiltro): Promise<void> {
    if (chip.clave === 'busqueda') {
      this.searchTerm.set('');
      await this.performFilters();
    } else if (chip.clave === 'ubicacion' && this.selectedUbicaciones().includes(chip.valor)) {
      this.removeUbicacion(chip.valor);
    } else {
      await this.clearFilter(chip.clave);
    }
  }

  async recargar(): Promise<void> {
    this.savedPage.set(this.currentPage() || 1);
    await this.performFiltersWithoutUrlUpdate();
  }

  async goToSpecificPage(page: number) {
    if (this.artworksService.isValidPageNumber(page)) {
      await this.artworksService.goToPage(page);
      this.savedPage.set(this.currentPage());
      this.saveFiltersToStorage();
    }
  }

  private saveFiltersToStorage() {
    const filters = {
      searchTerm: this.searchTerm(),
      ubicacionFilter: this.ubicacionFilter(),
      selectedUbicaciones: this.selectedUbicaciones(),
      responsableFilter: this.responsableFilter(),
      autorFilter: this.autorFilter(),
      tecnicaFilter: this.tecnicaFilter(),
      faltaFilter: this.faltaFilter(),
      currentPage: this.currentPage(),
      showAdvancedFilters: this.showAdvancedFilters(),
      timestamp: Date.now(),
    };
    guardarAlmacen(this.FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }

  private loadFiltersFromStorage(): boolean {
    try {
      const saved = leerAlmacen(this.FILTERS_STORAGE_KEY);
      if (!saved) return false;
      const filters = JSON.parse(saved);
      const isExpired = Date.now() - filters.timestamp > 24 * 60 * 60 * 1000;
      if (isExpired) {
        borrarAlmacen(this.FILTERS_STORAGE_KEY);
        return false;
      }
      const puedeFiltrarRestringido = this.isAdmin();
      this.searchTerm.set(filters.searchTerm || '');
      this.ubicacionFilter.set(puedeFiltrarRestringido ? filters.ubicacionFilter || '' : '');
      this.selectedUbicaciones.set(puedeFiltrarRestringido ? filters.selectedUbicaciones || [] : []);
      this.responsableFilter.set(puedeFiltrarRestringido ? filters.responsableFilter || '' : '');
      this.autorFilter.set(filters.autorFilter || '');
      this.tecnicaFilter.set(filters.tecnicaFilter || '');
      this.faltaFilter.set(puedeFiltrarRestringido && esDatoFaltante(filters.faltaFilter) ? filters.faltaFilter : '');
      this.showAdvancedFilters.set(filters.showAdvancedFilters || false);
      this.savedPage.set(filters.currentPage || 1);
      return true;
    } catch (error) {
      console.warn('Error al cargar filtros guardados:', error);
      this.clearFiltersFromStorage();
      return false;
    }
  }

  private clearFiltersFromStorage() {
    borrarAlmacen(this.FILTERS_STORAGE_KEY);
  }

  private setupFilters() {
    // Se compara con el filtro vigente y no con el último valor emitido: los chips y «Limpiar» cambian la señal sin pasar por aquí.
    const conEspera = (fuente: Subject<string>, filtro: WritableSignal<string>) =>
      fuente
        .pipe(debounceTime(300), filter((valor) => valor !== filtro()), takeUntil(this.destroy$))
        .subscribe(async (valor) => {
          filtro.set(valor);
          await this.performFilters();
        });
    conEspera(this.searchSubject, this.searchTerm);
    conEspera(this.ubicacionSubject, this.ubicacionFilter);
    conEspera(this.responsableSubject, this.responsableFilter);
    conEspera(this.autorSubject, this.autorFilter);
    conEspera(this.tecnicaSubject, this.tecnicaFilter);
  }

  private listenToQueryParams() {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
      const hasQueryParams = Object.keys(params).some((key) => params[key]);

      if (!hasQueryParams && !this.isInitialized()) {
        if (this.loadFiltersFromStorage()) {
          await this.performFiltersWithoutUrlUpdate();
          this.isInitialized.set(true);
          return;
        }
      }

      // La URL que emite una navegacion propia aun no lleva el filtro pendiente: no debe pisarlo.
      if (this.isInitialized() && (this.filteringInProgress() || this.filtroPendiente)) return;

      const search = params['search'] || '';
      // ubicacion y responsable son columnas restringidas: si no se ignoran
      // aqui, un visitante podria usar la URL para deducir su contenido
      // aunque la interfaz no muestre esos filtros.
      const puedeFiltrarRestringido = this.isAdmin();
      const ubicacion = puedeFiltrarRestringido ? params['ubicacion'] || '' : '';
      const ubicaciones = puedeFiltrarRestringido && params['ubicaciones'] ? params['ubicaciones'].split(',') : [];
      const responsable = puedeFiltrarRestringido ? params['responsable'] || '' : '';
      const autor = params['autor'] || '';
      const tecnica = params['tecnica'] || '';
      const falta: DatoFaltante | '' = puedeFiltrarRestringido && esDatoFaltante(params['falta']) ? params['falta'] : '';

      const filterUbicacion = ubicaciones.length > 0 ? ubicaciones : ubicacion;
      const desdeUrl = { search, ubicacion: filterUbicacion, responsable, autor, tecnica, falta };
      if (this.isInitialized() && JSON.stringify(desdeUrl) === JSON.stringify(this.filtrosActuales())) return;

      this.searchTerm.set(search);
      this.ubicacionFilter.set(ubicacion);
      this.selectedUbicaciones.set(ubicaciones);
      this.responsableFilter.set(responsable);
      this.autorFilter.set(autor);
      this.tecnicaFilter.set(tecnica);
      this.faltaFilter.set(falta);

      if (this.isInitialized()) {
        this.savedPage.set(1);
        await this.performFiltersWithoutUrlUpdate();
      } else {
        this.isInitialized.set(true);
        if (search || filterUbicacion || responsable || autor || tecnica || falta) {
          await this.artworksService.filterArtworks({ search, ubicacion: filterUbicacion, responsable, autor, tecnica, falta }, 1);
        } else {
          await this.artworksService.getAllArtworks();
        }
      }
    });
  }

  private filtrosActuales() {
    const ubicacion = this.selectedUbicaciones().length > 0 ? this.selectedUbicaciones() : this.ubicacionFilter();
    return {
      search: this.searchTerm(),
      ubicacion,
      responsable: this.responsableFilter(),
      autor: this.autorFilter(),
      tecnica: this.tecnicaFilter(),
      falta: this.faltaFilter(),
    };
  }

  /** Un filtro que llega durante otra carga se aplica al terminarla, con los valores de ese momento. */
  async performFilters() {
    if (this.filteringInProgress()) {
      this.filtroPendiente = true;
      return;
    }
    this.filteringInProgress.set(true);
    try {
      const filters = this.filtrosActuales();
      const ubicacion = filters.ubicacion;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          search: filters.search || null,
          responsable: filters.responsable || null,
          autor: filters.autor || null,
          tecnica: filters.tecnica || null,
          falta: filters.falta || null,
          ubicaciones: Array.isArray(ubicacion) && ubicacion.length ? ubicacion.join(',') : null,
          ubicacion: typeof ubicacion === 'string' && ubicacion ? ubicacion : null,
          page: null,
        },
        queryParamsHandling: 'merge',
      });
      await this.artworksService.filterArtworks(filters, 1);
      this.saveFiltersToStorage();
    } finally {
      this.filteringInProgress.set(false);
    }
    await this.aplicarPendiente();
  }

  async performFiltersWithoutUrlUpdate() {
    if (this.filteringInProgress()) {
      this.filtroPendiente = true;
      return;
    }
    this.filteringInProgress.set(true);
    try {
      await this.artworksService.filterArtworks(this.filtrosActuales(), this.savedPage());
      this.savedPage.set(this.currentPage());
      this.saveFiltersToStorage();
    } finally {
      this.filteringInProgress.set(false);
    }
    await this.aplicarPendiente();
  }

  private async aplicarPendiente() {
    if (!this.filtroPendiente) return;
    this.filtroPendiente = false;
    await this.performFilters();
  }

  async clearAllFilters() {
    this.searchTerm.set('');
    this.ubicacionFilter.set('');
    this.selectedUbicaciones.set([]);
    this.responsableFilter.set('');
    this.autorFilter.set('');
    this.tecnicaFilter.set('');
    this.faltaFilter.set('');
    this.clearFiltersFromStorage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: null, ubicacion: null, ubicaciones: null, responsable: null, autor: null, tecnica: null, falta: null, page: null },
      queryParamsHandling: 'merge',
    });
    await this.artworksService.clearAllFilters();
  }

  async clearFilter(filterType: Exclude<ClaveChip, 'busqueda'>) {
    if (filterType === 'ubicacion') {
      this.ubicacionFilter.set('');
      this.selectedUbicaciones.set([]);
    } else if (filterType === 'responsable') {
      this.responsableFilter.set('');
    } else if (filterType === 'autor') {
      this.autorFilter.set('');
    } else if (filterType === 'falta') {
      this.faltaFilter.set('');
    } else {
      this.tecnicaFilter.set('');
    }
    await this.performFilters();
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.update((abierto) => !abierto);
    this.saveFiltersToStorage();
  }

  addUbicacion() {
    const ubicacion = this.ubicacionFilter().trim();
    if (ubicacion && !this.selectedUbicaciones().includes(ubicacion)) {
      this.selectedUbicaciones.update((ubicaciones) => [...ubicaciones, ubicacion]);
      this.ubicacionFilter.set('');
      this.performFilters();
    }
  }

  /** Enter puede llegar antes de que pasen los 300 ms de espera: se toma el texto del campo y se descarta el pendiente. */
  alAgregarUbicacion(valor: string): void {
    this.ubicacionSubject.next('');
    this.ubicacionFilter.set(valor);
    this.addUbicacion();
  }

  removeUbicacion(ubicacion: string) {
    this.selectedUbicaciones.update((ubicaciones) => ubicaciones.filter((u) => u !== ubicacion));
    this.performFilters();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
