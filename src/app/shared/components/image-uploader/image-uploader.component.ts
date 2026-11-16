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
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ImageService } from '../../services/image.service';
import { ArtworkImage } from '../../models/image.model';

@Component({
  selector: 'app-image-uploader',
  imports: [],
  templateUrl: './image-uploader.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUploaderComponent implements OnInit, OnChanges, OnDestroy {
  private imageService = inject(ImageService);

  @Input() existingImages: ArtworkImage[] = [];
  @Output() imagesChanged = new EventEmitter<ArtworkImage[]>();
  @Output() isUploading = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput!: ElementRef;

  // Signals para el estado del componente
  private pendientes = signal<{ archivo: File; url: string }[]>([]);
  private isDragging = signal(false);
  private allImages = signal<ArtworkImage[]>([]);
  /** Motivos de rechazo a mostrar al usuario (antes solo iban a console.warn). */
  rejectedFiles = signal<string[]>([]);
  /**
   * Imagenes existentes que el usuario quito del formulario. No se borran del
   * Storage aqui: solo al guardar. Asi, cancelar el formulario no destruye
   * archivos de forma irreversible.
   */
  private removedImages = signal<ArtworkImage[]>([]);

  // Computed properties
  hasFiles = computed(() => this.pendientes().length > 0);
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
    this.vaciarPendientes();
    this.removedImages.set([]);
    this.rejectedFiles.set([]);
    this.clearFileInput();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.agregarPendientes(this.validateFiles(Array.from(input.files)));
    }
    this.clearFileInput();
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
      this.agregarPendientes(this.validateFiles(Array.from(files)));
    }
  }

  /**
   * Quita la imagen de la lista pero NO la borra del Storage: eso ocurre al
   * guardar el formulario. Antes se borraba aqui mismo, asi que pulsar
   * "Cancelar" despues dejaba el archivo destruido y la fila apuntando a nada.
   */
  removeImage(index: number): void {
    const images = this.allImages();
    const imageToRemove = images[index];
    if (!imageToRemove) return;

    if (imageToRemove.id !== undefined) {
      this.removedImages.update((prev) => [...prev, imageToRemove]);
    }

    const updatedImages = images.filter((_, i) => i !== index);
    this.allImages.set(updatedImages);
    this.imagesChanged.emit(updatedImages);
  }

  /** Imagenes existentes marcadas para borrar al guardar. */
  getRemovedImages(): ArtworkImage[] {
    return this.removedImages();
  }

  removeSelectedFile(index: number): void {
    const quitado = this.pendientes()[index];
    if (!quitado) return;
    URL.revokeObjectURL(quitado.url);
    this.pendientes.update((lista) => lista.filter((_, i) => i !== index));
  }

  ngOnDestroy(): void {
    this.vaciarPendientes();
  }

  private agregarPendientes(archivos: File[]): void {
    const nuevos = archivos.map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) }));
    this.pendientes.update((lista) => [...lista, ...nuevos]);
  }

  private vaciarPendientes(): void {
    for (const p of this.pendientes()) URL.revokeObjectURL(p.url);
    this.pendientes.set([]);
  }

  clearFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  clearAllFiles(): void {
    this.vaciarPendientes();
    this.clearFileInput();
  }

  private validateFiles(files: File[]): File[] {
    const rechazados: string[] = [];

    const validos = files.filter((file) => {
      const isValidType = this.imageService.isValidImageType(file);
      const isValidSize = this.imageService.isValidImageSize(file, 5); // 5MB max

      if (!isValidType) {
        rechazados.push(
          `${file.name}: formato no admitido (usa JPG, PNG o WebP)`
        );
      } else if (!isValidSize) {
        // Se indica el tamano real porque el limite es de 5 MiB (5.242.880 B)
        // y el Finder/Explorador muestra MB decimales: un archivo que el
        // sistema llama "5,1 MB" en realidad si cabe, y sin este dato el
        // mensaje parece equivocado.
        rechazados.push(
          `${file.name}: pesa ${this.formatearTamano(
            file.size
          )} y el máximo son 5 MiB (5,24 MB)`
        );
      }

      return isValidType && isValidSize;
    });

    // Antes esto solo se registraba en consola, asi que al usuario le parecia
    // que arrastrar un archivo grande simplemente no hacia nada.
    this.rejectedFiles.set(rechazados);
    return validos;
  }

  dismissRejected(): void {
    this.rejectedFiles.set([]);
  }

  /** Tamano legible, en las mismas unidades decimales que muestra el sistema. */
  private formatearTamano(bytes: number): string {
    return `${(bytes / 1e6).toLocaleString('es', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} MB`;
  }

  // Getters para el template
  get pendientesArray() {
    return this.pendientes();
  }

  get allImagesArray() {
    return this.allImages();
  }

  get isDraggingValue() {
    return this.isDragging();
  }

  // Método para obtener archivos seleccionados sin subir
  getSelectedFiles(): File[] {
    return this.pendientes().map((p) => p.archivo);
  }

  // Método para obtener todas las imágenes (subidas + existentes)
  getAllImages(): ArtworkImage[] {
    return this.allImages();
  }
}
