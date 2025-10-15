import {
  Component,
  EventEmitter,
  inject,
  Output,
  ViewChild,
  ElementRef,
  Input,
  signal,
  computed,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';
import {
  ArtworkImage,
  ImageUploadRequest,
  ImageUploadResponse,
} from '../../models/image.model';

@Component({
  selector: 'app-image-uploader',
  imports: [CommonModule],
  templateUrl: './image-uploader.html',
})
export class ImageUploaderComponent implements OnChanges {
  private imageService = inject(ImageService);

  @Input() existingImages: ArtworkImage[] = [];
  @Output() imagesChanged = new EventEmitter<ArtworkImage[]>();
  @Output() isUploading = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput!: ElementRef;

  // Signals para el estado del componente
  private selectedFiles = signal<File[]>([]);
  private isDragging = signal(false);
  private uploadProgress = signal(0);
  private allImages = signal<ArtworkImage[]>([]);

  // Computed properties
  hasFiles = computed(() => this.selectedFiles().length > 0);
  hasImages = computed(() => this.allImages().length > 0);

  constructor() {
    // Inicializar con imágenes existentes
    this.allImages.set([...this.existingImages]);
  }

  ngOnInit() {
    this.allImages.set([...this.existingImages]);
  }

  ngOnChanges() {
    // Reinicializar cuando cambien las imágenes existentes
    this.allImages.set([...this.existingImages]);
    this.selectedFiles.set([]);
    this.clearFileInput();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const validFiles = this.validateFiles(Array.from(input.files));
      this.selectedFiles.set(validFiles);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const validFiles = this.validateFiles(Array.from(files));
      this.selectedFiles.update((current) => [...current, ...validFiles]);
    }
  }

  async uploadImages(): Promise<ArtworkImage[]> {
    if (this.selectedFiles().length === 0) {
      return this.allImages();
    }

    this.isUploading.emit(true);
    this.uploadProgress.set(0);

    try {
      const uploadRequests: ImageUploadRequest[] = this.selectedFiles().map(
        (file) => ({
          file,
          filename: file.name,
        })
      );

      const uploadResults = await this.imageService.uploadMultipleImages(
        uploadRequests
      );

      const newImages: ArtworkImage[] = uploadResults.map((result) => ({
        url: result.url,
        nombre: result.filename,
        tamano:
          this.selectedFiles().find((f) => f.name === result.filename)?.size ||
          0,
      }));

      this.allImages.update((current) => [...current, ...newImages]);
      this.selectedFiles.set([]);
      this.clearFileInput();

      this.imagesChanged.emit(this.allImages());
      return this.allImages();
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    } finally {
      this.isUploading.emit(false);
      this.uploadProgress.set(0);
    }
  }

  async removeImage(index: number): Promise<void> {
    const images = this.allImages();
    const imageToRemove = images[index];

    if (imageToRemove.url) {
      try {
        const path = this.imageService.getPathFromUrl(imageToRemove.url);
        await this.imageService.deleteImage(path);
      } catch (error) {
        console.error('Error deleting image from storage:', error);
      }
    }

    const updatedImages = images.filter((_, i) => i !== index);
    this.allImages.set(updatedImages);
    this.imagesChanged.emit(updatedImages);
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  clearFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  clearAllFiles(): void {
    this.selectedFiles.set([]);
    this.clearFileInput();
  }

  private validateFiles(files: File[]): File[] {
    return files.filter((file) => {
      const isValidType = this.imageService.isValidImageType(file);
      const isValidSize = this.imageService.isValidImageSize(file, 5); // 5MB max

      if (!isValidType) {
        console.warn(`Archivo ${file.name} no es un tipo de imagen válido`);
      }
      if (!isValidSize) {
        console.warn(`Archivo ${file.name} es demasiado grande (máximo 5MB)`);
      }

      return isValidType && isValidSize;
    });
  }

  // Getters para el template
  get selectedFilesArray() {
    return this.selectedFiles();
  }

  get allImagesArray() {
    return this.allImages();
  }

  get isDraggingValue() {
    return this.isDragging();
  }

  // Método para obtener archivos seleccionados sin subir
  getSelectedFiles(): File[] {
    return this.selectedFiles();
  }

  // Método para obtener todas las imágenes (subidas + existentes)
  getAllImages(): ArtworkImage[] {
    return this.allImages();
  }
}
