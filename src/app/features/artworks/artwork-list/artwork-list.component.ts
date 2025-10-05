import { ArtworksService } from '../data-access/artworks.service';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  signal,
  OnDestroy,
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

  // Signals para filtros
  searchTerm = signal<string>('');
  ubicacionFilter = signal<string>('');
  responsableFilter = signal<string>('');
  autorFilter = signal<string>('');
  tecnicaFilter = signal<string>('');

  // Computed para saber si hay filtros activos
  hasActiveFilters = computed(() => {
    return (
      this.searchTerm() !== '' ||
      this.ubicacionFilter() !== '' ||
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

  private listenToQueryParams() {
    // Escuchar cambios en query parameters
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const search = params['search'] || '';
        const ubicacion = params['ubicacion'] || '';
        const responsable = params['responsable'] || '';
        const autor = params['autor'] || '';
        const tecnica = params['tecnica'] || '';

        // Actualizar signals sin triggear búsqueda
        if (search !== this.searchTerm()) this.searchTerm.set(search);
        if (ubicacion !== this.ubicacionFilter())
          this.ubicacionFilter.set(ubicacion);
        if (responsable !== this.responsableFilter())
          this.responsableFilter.set(responsable);
        if (autor !== this.autorFilter()) this.autorFilter.set(autor);
        if (tecnica !== this.tecnicaFilter()) this.tecnicaFilter.set(tecnica);
      });
  }

  async onLogout() {
    await this.authService.signOut();
    this.router.navigateByUrl('/auth/log-in');
  }

  viewArtworkDetails(id: number) {
    this.router.navigateByUrl(`/artwork/${id}`);
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
        console.log('Obra eliminada exitosamente');

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
    // Cargar datos basado en query parameters iniciales
    const currentParams = this.route.snapshot.queryParams;
    const search = currentParams['search'] || '';
    const ubicacion = currentParams['ubicacion'] || '';
    const responsable = currentParams['responsable'] || '';
    const autor = currentParams['autor'] || '';
    const tecnica = currentParams['tecnica'] || '';

    // Establecer valores iniciales
    this.searchTerm.set(search);
    this.ubicacionFilter.set(ubicacion);
    this.responsableFilter.set(responsable);
    this.autorFilter.set(autor);
    this.tecnicaFilter.set(tecnica);

    // Cargar datos con filtros iniciales
    if (search || ubicacion || responsable || autor || tecnica) {
      this.artworksService.filterArtworks(
        {
          search,
          ubicacion,
          responsable,
          autor,
          tecnica,
        },
        1
      );
    } else {
      this.artworksService.getAllArtworks();
    }
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
  }

  async nextPage() {
    await this.artworksService.nextPage();
  }

  async previousPage() {
    await this.artworksService.previousPage();
  }

  async firstPage() {
    await this.artworksService.firstPage();
  }

  async lastPage() {
    await this.artworksService.lastPage();
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

  // Métodos de búsqueda y filtrado
  async performFilters() {
    const filters = {
      search: this.searchTerm(),
      ubicacion: this.ubicacionFilter(),
      responsable: this.responsableFilter(),
      autor: this.autorFilter(),
      tecnica: this.tecnicaFilter(),
    };

    // Actualizar URL con query parameters
    const queryParams: any = {};
    Object.entries(filters).forEach(([key, value]) => {
      queryParams[key] = value || null;
    });
    queryParams.page = null; // Reset página

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });

    // Realizar filtrado
    await this.artworksService.filterArtworks(filters, 1);
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
    this.responsableFilter.set('');
    this.autorFilter.set('');
    this.tecnicaFilter.set('');

    // Limpiar URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: null,
        ubicacion: null,
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
}
