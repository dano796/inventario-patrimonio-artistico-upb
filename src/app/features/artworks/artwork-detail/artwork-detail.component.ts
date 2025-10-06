import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ArtworksService } from '../data-access/artworks.service';
import { AuthService } from '../../../core/services/auth.service';
import { ArtworkImage } from '../../../shared/models/artwork-image.model';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-artwork-detail',
  imports: [CommonModule, ConfirmModalComponent],
  templateUrl: './artwork-detail.html',
})
export class ArtworkDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private artworksService = inject(ArtworksService);
  private authService = inject(AuthService);

  // Signals para estado local - usar directamente el AuthService
  isAuthenticated = this.authService.isAuthenticated;
  isAdmin = this.authService.isAdmin;
  isAuthLoading = this.authService.isLoading;

  // Signal para el índice de la imagen actual
  currentImageIndex = signal<number>(0);

  // Signals para el modal de eliminación
  isModalOpen = signal(false);
  isDeleting = signal(false);
  deleteError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Computed properties del servicio
  artwork = this.artworksService.selectedArtwork;
  isLoading = this.artworksService.loading;
  error = this.artworksService.error;

  constructor() {
    // No necesitamos manejar la autenticación aquí, el AuthService lo hace automáticamente
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.currentImageIndex.set(0); // Reset image index when loading new artwork
        this.artworksService.getArtworkById(Number(id));
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy(): void {
    // Limpiar la obra seleccionada cuando se destruye el componente
    this.artworksService.clearSelectedArtwork();
  }

  onEditArtwork(): void {
    if (!this.isAdmin()) {
      this.router.navigate(['/autenticacion/iniciar-sesion']);
      return;
    }
    if (this.artwork()) {
      this.router.navigate(['/editar', this.artwork()!.id]);
    }
  }

  onDeleteArtwork(): void {
    if (!this.isAdmin()) {
      this.router.navigate(['/autenticacion/iniciar-sesion']);
      return;
    }
    this.deleteError.set(null);
    this.isModalOpen.set(true);
  }

  async handleDeleteConfirmation(confirmed: boolean) {
    if (confirmed && this.artwork()) {
      this.isDeleting.set(true);
      this.deleteError.set(null);

      try {
        await this.artworksService.deleteArtwork(this.artwork()!.id);
        console.log('Obra eliminada exitosamente');

        // Mostrar mensaje de éxito
        this.successMessage.set('Obra eliminada exitosamente');

        // Redirigir a la lista después de un breve delay
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 1500);
      } catch (error) {
        console.error('Error al eliminar obra:', error);
        this.deleteError.set(
          'Error al eliminar la obra. Por favor, intente nuevamente.'
        );
        // No cerrar el modal si hay error
        this.isDeleting.set(false);
        return;
      }
    }

    // Cerrar modal y limpiar estado
    this.isModalOpen.set(false);
    this.isDeleting.set(false);
    this.deleteError.set(null);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  // Métodos para navegación de imágenes
  getCurrentImage(): ArtworkImage {
    const images = this.artwork()?.imagenes || [];
    return images[this.currentImageIndex()] || images[0];
  }

  nextImage(): void {
    const images = this.artwork()?.imagenes || [];
    if (images.length > 1) {
      const nextIndex = (this.currentImageIndex() + 1) % images.length;
      this.currentImageIndex.set(nextIndex);
    }
  }

  prevImage(): void {
    const images = this.artwork()?.imagenes || [];
    if (images.length > 1) {
      const prevIndex =
        this.currentImageIndex() === 0
          ? images.length - 1
          : this.currentImageIndex() - 1;
      this.currentImageIndex.set(prevIndex);
    }
  }

  setCurrentImage(index: number): void {
    const images = this.artwork()?.imagenes || [];
    if (index >= 0 && index < images.length) {
      this.currentImageIndex.set(index);
    }
  }

  getDeleteConfirmMessage(): string {
    const artwork = this.artwork();
    if (artwork?.titulo) {
      return `¿Está seguro de que desea eliminar la obra "${artwork.titulo}"?`;
    }
    return '¿Está seguro de que desea eliminar esta obra de arte?';
  }
}
