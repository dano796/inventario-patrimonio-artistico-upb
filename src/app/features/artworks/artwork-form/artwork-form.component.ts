import { Component, inject, OnInit, ViewChild, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ArtworksService } from '../data-access/artworks.service';
import { ArtworkImage } from '../../../shared/models/artwork-image.model';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';

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
  imports: [CommonModule, ReactiveFormsModule, ImageUploaderComponent],
  templateUrl: './artwork-form.component.html',
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
      Validators.min(1800),
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
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.loadArtwork(Number(id));
    } else {
      // Limpiar el artwork seleccionado cuando se crea una nueva obra
      this.artworksService.clearSelectedArtwork();
    }
  }

  private async loadArtwork(id: number): Promise<void> {
    try {
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
      }
    } catch (error) {
      console.error('Error loading artwork:', error);
      this.errorMessage.set('Error al cargar la obra de arte');
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
        const existingImages = this.imageUploader
          .getAllImages()
          .filter(
            (img) => !newImageFiles.some((file) => file.name === img.nombre)
          );

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
