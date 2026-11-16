import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageUploaderComponent } from './image-uploader.component';

describe('ImageUploaderComponent', () => {
  let component: ImageUploaderComponent;
  let fixture: ComponentFixture<ImageUploaderComponent>;

  const imagen = (nombre: string) => new File([new Uint8Array(10)], nombre, { type: 'image/png' });

  const elegir = (...archivos: File[]) => {
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    const lista = new DataTransfer();
    archivos.forEach((a) => lista.items.add(a));
    input.files = lista.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageUploaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageUploaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('elegir archivos dos veces los suma en vez de reemplazarlos', () => {
    elegir(imagen('a.png'));
    elegir(imagen('b.png'), imagen('c.png'));
    expect(component.getSelectedFiles().map((f) => f.name)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('cada archivo pendiente se muestra con su vista previa', () => {
    elegir(imagen('a.png'), imagen('b.png'));
    const vistas = fixture.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    expect(vistas.length).toBe(2);
    vistas.forEach((img) => expect(img.src.startsWith('blob:')).toBeTrue());
  });

  it('quitar un pendiente libera su vista previa', () => {
    elegir(imagen('a.png'));
    const url = component.pendientesArray[0].url;
    spyOn(URL, 'revokeObjectURL');
    component.removeSelectedFile(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(component.getSelectedFiles()).toEqual([]);
  });
});
