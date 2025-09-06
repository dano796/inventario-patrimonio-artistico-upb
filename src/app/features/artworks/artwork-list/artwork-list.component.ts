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

  // Signals para el estado de autenticación
  private userSession = signal<any>(null);
  isAuthenticated = computed(() => !!this.userSession()?.user);

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

  constructor() {
    this.checkAuthStatus();
    this.setupAuthListener();
  }

  private async checkAuthStatus() {
    const { data } = await this.authService.session();
    this.userSession.set(data.session);
  }

  private setupAuthListener() {
    this.authService.onAuthStateChange((event, session) => {
      this.userSession.set(session);
    });
  }

  async onLogout() {
    await this.authService.signOut();
    this.router.navigateByUrl('/auth/log-in');
  }

  viewArtworkDetails(id: number) {
    this.router.navigateByUrl(`/obras/artwork/${id}`);
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
