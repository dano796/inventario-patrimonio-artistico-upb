import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ArtworksService } from '../../services/artworks.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmModalComponent } from '../../../../shared/components/confirm-modal/confirm-modal.component';
import { camposFicha, mensajeBorrado, NO_REGISTRA, subtituloFicha, ultimaCaptura } from '../../utils/ficha';

@Component({
  selector: 'app-artwork-detail',
  imports: [RouterLink, ConfirmModalComponent],
  templateUrl: './artwork-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private artworksService = inject(ArtworksService);
  private authService = inject(AuthService);

  isAdmin = this.authService.isAdmin;
  artwork = this.artworksService.selectedArtwork;
  isLoading = this.artworksService.loading;
  error = this.artworksService.error;

  currentImageIndex = signal(0);
  isModalOpen = signal(false);
  isDeleting = signal(false);
  deleteError = signal<string | null>(null);
  private id: number | null = null;

  imagenes = computed(() => this.artwork()?.imagenes ?? []);
  imagenActual = computed(() => this.imagenes()[this.currentImageIndex()] ?? this.imagenes()[0] ?? null);
  titulo = computed(() => this.artwork()?.titulo?.trim() || 'Sin título');
  subtitulo = computed(() => {
    const obra = this.artwork();
    return obra ? subtituloFicha(obra) : '';
  });
  campos = computed(() => {
    const obra = this.artwork();
    return obra ? camposFicha(obra, this.isAdmin()) : [];
  });
  observaciones = computed(() => this.artwork()?.observaciones?.trim() || NO_REGISTRA);
  captura = computed(() => ultimaCaptura(this.imagenes()));
  mensajeBorrado = computed(() => mensajeBorrado(this.titulo(), this.imagenes().length));


  async ngOnInit(): Promise<void> {
    // Hasta que el perfil carga, isAdmin() es false y la obra saldria de `obras`, sin las columnas restringidas.
    await this.authService.listo();
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        this.router.navigate(['/']);
        return;
      }
      this.id = id;
      this.currentImageIndex.set(0);
      this.artworksService.getArtworkById(id);
    });
  }

  ngOnDestroy(): void {
    this.artworksService.clearSelectedArtwork();
  }

  recargar(): void {
    if (this.id !== null) this.artworksService.getArtworkById(this.id);
  }

  onDeleteArtwork(): void {
    this.deleteError.set(null);
    this.isModalOpen.set(true);
  }

  async handleDeleteConfirmation(confirmed: boolean) {
    const obra = this.artwork();
    if (!confirmed || !obra) {
      this.isModalOpen.set(false);
      return;
    }
    this.isDeleting.set(true);
    this.deleteError.set(null);
    try {
      await this.artworksService.deleteArtwork(obra.id);
      this.isModalOpen.set(false);
      await this.router.navigate(['/']);
    } catch (error) {
      console.error('Error al eliminar obra:', error);
      this.deleteError.set('No se pudo eliminar la obra. Inténtalo de nuevo.');
    } finally {
      this.isDeleting.set(false);
    }
  }

  nextImage(): void {
    const total = this.imagenes().length;
    if (total > 1) this.currentImageIndex.set((this.currentImageIndex() + 1) % total);
  }

  prevImage(): void {
    const total = this.imagenes().length;
    if (total > 1) this.currentImageIndex.set((this.currentImageIndex() - 1 + total) % total);
  }

  setCurrentImage(index: number): void {
    if (index >= 0 && index < this.imagenes().length) this.currentImageIndex.set(index);
  }
}
