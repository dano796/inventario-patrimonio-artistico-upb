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
      providers: [
        {
          provide: SupabaseService,
          useValue: { supabaseClient: { storage: { from: () => cubo } }, ensureActiveSession: async () => true },
        },
      ],
    });
    const servicio = TestBed.inject(ImageService);

    const respuesta = await servicio.uploadImage({ file: await webp(), filename: 'foto.webp' });

    const [ruta, archivo] = upload.calls.mostRecent().args as [string, File];
    expect(ruta).toMatch(/\.jpg$/);
    expect(archivo.type).toBe('image/jpeg');
    expect(respuesta.url).toMatch(/\.jpg$/);
  });

  it('usa el cliente vigente aunque se haya reemplazado después de crear el servicio, y con sesión activa', async () => {
    const cubo = (nombre: string) => ({
      upload: jasmine.createSpy(`upload ${nombre}`).and.resolveTo({ data: {}, error: null }),
      remove: jasmine.createSpy(`remove ${nombre}`).and.resolveTo({ error: null }),
      getPublicUrl: (ruta: string) => ({ data: { publicUrl: `https://x/${ruta}` } }),
    });
    const viejo = cubo('viejo');
    const nuevo = cubo('nuevo');
    const supabase = {
      supabaseClient: { storage: { from: () => viejo } },
      ensureActiveSession: jasmine.createSpy('ensureActiveSession').and.resolveTo(true),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: supabase }] });
    const servicio = TestBed.inject(ImageService);
    supabase.supabaseClient = { storage: { from: () => nuevo } };

    await servicio.uploadImage({ file: new File(['x'], 'a.jpg', { type: 'image/jpeg' }), filename: 'a.jpg' });
    await servicio.deleteImage('a.jpg');
    await servicio.deleteMultipleImages(['a.jpg']);

    expect(viejo.upload).not.toHaveBeenCalled();
    expect(nuevo.upload).toHaveBeenCalled();
    expect(nuevo.remove).toHaveBeenCalledTimes(2);
    expect(supabase.ensureActiveSession).toHaveBeenCalledTimes(3);
  });
});
