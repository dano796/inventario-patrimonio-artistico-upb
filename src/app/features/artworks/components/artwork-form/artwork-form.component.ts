import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ArtworksService } from '../../services/artworks.service';
import { ArtworkImage } from '../../../../shared/models/image.model';
import { ImageUploaderComponent } from '../../../../shared/components/image-uploader/image-uploader.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowsPointingOut, heroCalendarDays, heroCheck, heroCheckBadge, heroInformationCircle, heroLightBulb, heroMapPin, heroPencil, heroPencilSquare, heroPhoto, heroUser } from '@ng-icons/heroicons/outline';
import { heroCheckCircleSolid, heroInformationCircleSolid } from '@ng-icons/heroicons/solid';

// Interfaz para el formulario
interface ArtworkFormData {
  titulo: FormControl<string>;
  autor: FormControl<string | null>;
  tecnica: FormControl<string | null>;
  dimension: FormControl<string | null>;
  ano: FormControl<number | null>;
  ubicacion: FormControl<string | null>;
  valor: FormControl<number | null>;
  observaciones: FormControl<string | null>;
  responsable: FormControl<string | null>;
}

@Component({
  selector: 'app-artwork-form',
  standalone: true,
  imports: [ReactiveFormsModule, ImageUploaderComponent, NgIcon],
  templateUrl: './artwork-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ heroArrowsPointingOut, heroCalendarDays, heroCheck, heroCheckBadge, heroCheckCircleSolid, heroInformationCircle, heroInformationCircleSolid, heroLightBulb, heroMapPin, heroPencil, heroPencilSquare, heroPhoto, heroUser })],
})
export class ArtworkFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private artworksService = inject(ArtworksService);
  private formBuilder = inject(FormBuilder);

  @ViewChild(ImageUploaderComponent) imageUploader!: ImageUploaderComponent;

  // Signals para el estado del componente
  isEditMode = signal(false);
  isLoading = signal(false);
  isUploadingImages = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  uploadedImages = signal<ArtworkImage[]>([]);

  // Computed properties del servicio
  loading = this.artworksService.loading;
  error = this.artworksService.error;
  selectedArtwork = this.artworksService.selectedArtwork;

  // Getter para el año actual
  get currentYear(): number {
    return new Date().getFullYear();
  }

  // Formulario reactivo
  artworkForm = this.formBuilder.group<ArtworkFormData>({
    titulo: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(200),
    ]),
    autor: this.formBuilder.control<string | null>(null, [
      Validators.maxLength(100),
    ]),
    tecnica: this.formBuilder.control<string | null>(null, [
      Validators.maxLength(100),
    ]),
    dimension: this.formBuilder.control<string | null>(null, [
      Validators.maxLength(50),
    ]),
    ano: this.formBuilder.control<number | null>(null, [
      Validators.min(1700),
      Validators.max(new Date().getFullYear()),
    ]),
    ubicacion: this.formBuilder.control<string | null>(null, [
      Validators.maxLength(200),
    ]),
    valor: this.formBuilder.control<number | null>(null, [Validators.min(0)]),
    observaciones: this.formBuilder.control<string | null>(null, [
      Validators.maxLength(1000),
    ]),
    responsable: this.formBuilder.control<string | null>(null, [
      Validators.maxLength(100),
    ]),
  });

  ngOnInit(): void {
    // Limpiar estados anteriores
    this.isLoading.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.uploadedImages.set([]);

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.loadArtwork(Number(id));
    } else {
      this.isEditMode.set(false);
      // Limpiar el artwork seleccionado cuando se crea una nueva obra
      this.artworksService.clearSelectedArtwork();
    }
  }

  private async loadArtwork(id: number): Promise<void> {
    try {
      this.isLoading.set(true);
      this.errorMessage.set(null);

      await this.artworksService.getArtworkById(id);
      const artwork = this.selectedArtwork();

      if (artwork) {
        this.artworkForm.patchValue({
          titulo: artwork.titulo,
          autor: artwork.autor,
          tecnica: artwork.tecnica,
          dimension: artwork.dimension,
          ano: artwork.ano,
          ubicacion: artwork.ubicacion,
          valor: artwork.valor,
          observaciones: artwork.observaciones,
          responsable: artwork.responsable,
        });

        // Cargar imágenes existentes
        if (artwork.imagenes) {
          this.uploadedImages.set(artwork.imagenes);
        }
      }
    } catch (error) {
      console.error('Error loading artwork:', error);
      this.errorMessage.set(
        'Error al cargar la obra de arte. Por favor, intente nuevamente.'
      );

      // Redirigir al listado después de un error de carga
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 2000);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.artworkForm.invalid) {
      this.artworkForm.markAllAsTouched();
      this.errorMessage.set('Por favor, complete todos los campos requeridos');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      // Obtener datos del formulario
      const formData = this.artworkForm.getRawValue();

      // Limpiar campos vacíos
      const artworkData = {
        titulo: formData.titulo,
        autor: formData.autor || null,
        tecnica: formData.tecnica || null,
        dimension: formData.dimension || null,
        ano: formData.ano || null,
        ubicacion: formData.ubicacion || null,
        valor: formData.valor || null,
        observaciones: formData.observaciones || null,
        responsable: formData.responsable || null,
      };

      // Obtener archivos seleccionados del uploader
      const newImageFiles = this.imageUploader.getSelectedFiles();

      if (this.isEditMode()) {
        const id = Number(this.route.snapshot.paramMap.get('id'));
        // Las imagenes que se conservan son las que siguen en el uploader y ya
        // tienen id en base de datos. Antes se comparaba por nombre de archivo,
        // asi que subir una imagen con el mismo nombre que una existente
        // marcaba la existente para borrado.
        const existingImages = this.imageUploader
          .getAllImages()
          .filter((img) => img.id !== undefined);

        await this.artworksService.updateArtwork(
          id,
          artworkData,
          newImageFiles,
          existingImages
        );
        this.successMessage.set('Obra actualizada exitosamente');
      } else {
        await this.artworksService.createArtwork(artworkData, newImageFiles);
        this.successMessage.set('Obra creada exitosamente');
      }

      // Redirigir después de un breve delay
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 1500);
    } catch (error) {
      console.error('Error saving artwork:', error);
      this.errorMessage.set('Error al guardar la obra de arte');
    } finally {
      this.isLoading.set(false);
    }
  }

  onCancel(): void {
    this.router.navigate(['/']);
  }

  // Event handlers para el ImageUploader
  onImagesChanged(images: ArtworkImage[]): void {
    this.uploadedImages.set(images);
  }

  onImageUploading(isUploading: boolean): void {
    this.isUploadingImages.set(isUploading);
  }

  // Métodos de validación para el template
  isFieldInvalid(fieldName: keyof ArtworkFormData): boolean {
    const field = this.artworkForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: keyof ArtworkFormData): string {
    const field = this.artworkForm.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;

    if (errors['required']) return 'Este campo es requerido';
    if (errors['minlength'])
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength'])
      return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['min']) return `Valor mínimo: ${errors['min'].min}`;
    if (errors['max']) return `Valor máximo: ${errors['max'].max}`;

    return 'Campo inválido';
  }
}
