import { ArtworksService } from '../data-access/artworks.service';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-artwork-list',
  imports: [CommonModule, RouterLink, ConfirmModalComponent],
  templateUrl: './artwork-list.html',
})
export class ArtworkListComponent implements AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private artworksService = inject(ArtworksService);

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
    this.artworksService.getAllArtworks();
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
