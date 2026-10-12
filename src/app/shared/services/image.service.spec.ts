import { TestBed } from '@angular/core/testing';
import { ImageService } from './image.service';
import { SupabaseService } from '../../core/services/supabase.service';

async function webp(): Promise<File> {
  const lienzo = document.createElement('canvas');
  lienzo.width = 10;
  lienzo.height = 10;
  const blob = await new Promise<Blob>((r) => lienzo.toBlob((b) => r(b!), 'image/webp'));
  return new File([blob], 'foto.webp', { type: 'image/webp' });
}

describe('ImageService', () => {
  it('sube una foto WEBP como JPG, con extensión .jpg', async () => {
    const upload = jasmine.createSpy('upload').and.resolveTo({ data: {}, error: null });
    const cubo = { upload, getPublicUrl: (ruta: string) => ({ data: { publicUrl: `https://x/${ruta}` } }) };
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabaseClient: { storage: { from: () => cubo } } } }],
    });
    const servicio = TestBed.inject(ImageService);

    const respuesta = await servicio.uploadImage({ file: await webp(), filename: 'foto.webp' });

    const [ruta, archivo] = upload.calls.mostRecent().args as [string, File];
    expect(ruta).toMatch(/\.jpg$/);
    expect(archivo.type).toBe('image/jpeg');
    expect(respuesta.url).toMatch(/\.jpg$/);
  });
});
