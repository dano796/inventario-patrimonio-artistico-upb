import { TestBed } from '@angular/core/testing';
import { obraDesdeFila, SincronizacionDatosService } from './sincronizacion-datos.service';
import { SupabaseService } from '../../../core/services/supabase.service';

describe('obraDesdeFila', () => {
  it('convierte una fila de obras_admin, con sus imágenes, en una obra para el diff', () => {
    const obra = obraDesdeFila({
      id: 14, autor: 'Ana', titulo: 'Paisaje', tecnica: null, dimension: null, ano: 1998, ubicacion: 'Bloque 6',
      bloque_asignado: null, valor: '1200000', descripcion: null, responsable: 'ANA PÉREZ', cargo: 'DECANA',
      observaciones: null, imagenes: [{ id: 80, url: 'https://x/a.jpg' }],
    });
    expect(obra).toEqual({
      id: 14,
      campos: {
        autor: 'Ana', titulo: 'Paisaje', tecnica: null, dimension: null, ano: 1998, ubicacion: 'Bloque 6',
        bloque_asignado: null, valor: 1200000, descripcion: null, responsable: 'ANA PÉREZ', cargo: 'DECANA', observaciones: null,
      },
      imagenes: [{ id: 80, url: 'https://x/a.jpg' }],
    });
  });
});

describe('SincronizacionDatosService.aplicar', () => {
  function crear(respuesta: { data: unknown; error: unknown }) {
    const rpc = jasmine.createSpy('rpc').and.resolveTo(respuesta);
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabaseClient: { rpc }, ensureActiveSession: async () => true } }],
    });
    return { servicio: TestBed.inject(SincronizacionDatosService), rpc };
  }

  it('llama a aplicar_sincronizacion con la petición y devuelve su resultado', async () => {
    const resultado = { aplicados: 1, descartados: [], creadas: [] };
    const { servicio, rpc } = crear({ data: resultado, error: null });
    const peticion = { campos: [], cargos: [], altas: [], fotos: [] };

    expect(await servicio.aplicar(peticion)).toEqual(resultado);
    expect(rpc).toHaveBeenCalledWith('aplicar_sincronizacion', { peticion });
  });

  it('propaga el error de la RPC', async () => {
    const { servicio } = crear({ data: null, error: new Error('Solo un administrador puede sincronizar') });
    await expectAsync(servicio.aplicar({ campos: [], cargos: [], altas: [], fotos: [] })).toBeRejectedWithError(/administrador/);
  });
});

describe('SincronizacionDatosService.subirImagen', () => {
  function crear(opciones: { errorSubida?: unknown; errorFila?: unknown } = {}) {
    const upload = jasmine.createSpy('upload').and.resolveTo({ error: opciones.errorSubida ?? null });
    const remove = jasmine.createSpy('remove').and.resolveTo({ error: null });
    const getPublicUrl = (ruta: string) => ({ data: { publicUrl: `https://x/imagenes-obras/${ruta}` } });
    const single = jasmine.createSpy('single').and.resolveTo(
      opciones.errorFila ? { data: null, error: opciones.errorFila } : { data: { id: 901 }, error: null }
    );
    const select = jasmine.createSpy('select').and.returnValue({ single });
    const insert = jasmine.createSpy('insert').and.returnValue({ select });
    const storageFrom = jasmine.createSpy('storage.from').and.returnValue({ upload, remove, getPublicUrl });
    const from = jasmine.createSpy('from').and.returnValue({ insert });
    TestBed.configureTestingModule({
      providers: [{
        provide: SupabaseService,
        useValue: { supabaseClient: { from, storage: { from: storageFrom } }, ensureActiveSession: async () => true },
      }],
    });
    return { servicio: TestBed.inject(SincronizacionDatosService), upload, remove, insert, select, storageFrom, from };
  }

  it('sube el archivo tal cual al bucket y registra la imagen pidiendo solo su id', async () => {
    const { servicio, upload, insert, select, storageFrom, from } = crear();
    const datos = new Uint8Array([1, 2, 3]);

    expect(await servicio.subirImagen(721, 2, 'xl/media/image9.JPG', datos)).toBe(901);

    expect(storageFrom).toHaveBeenCalledWith('imagenes-obras');
    expect(upload).toHaveBeenCalledWith('sincronizacion/721-2.jpg', datos, { contentType: 'image/jpeg', upsert: false });
    expect(from).toHaveBeenCalledWith('imagenes');
    expect(insert).toHaveBeenCalledWith({
      id_obra: 721, url: 'https://x/imagenes-obras/sincronizacion/721-2.jpg', nombre: 'image9.JPG', tamano: 3,
    });
    expect(select).toHaveBeenCalledWith('id');
  });

  it('si el bucket rechaza el archivo no registra nada', async () => {
    const { servicio, insert } = crear({ errorSubida: new Error('Payload too large') });

    await expectAsync(servicio.subirImagen(721, 1, 'xl/media/image1.png', new Uint8Array(1))).toBeRejectedWithError(/too large/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('si no puede registrar la imagen borra el archivo subido', async () => {
    const { servicio, remove } = crear({ errorFila: new Error('permission denied') });

    await expectAsync(servicio.subirImagen(721, 1, 'xl/media/image1.png', new Uint8Array(1))).toBeRejectedWithError(/permission/);
    expect(remove).toHaveBeenCalledWith(['sincronizacion/721-1.png']);
  });
});

describe('SincronizacionDatosService.vincularLibro', () => {
  function crear(respuesta: { data: unknown; error: unknown }) {
    const select = jasmine.createSpy('select').and.resolveTo(respuesta);
    const eq = jasmine.createSpy('eq').and.returnValue({ select });
    const update = jasmine.createSpy('update').and.returnValue({ eq });
    const from = jasmine.createSpy('from').and.returnValue({ update });
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabaseClient: { from }, ensureActiveSession: async () => true } }],
    });
    return { servicio: TestBed.inject(SincronizacionDatosService), from, update, eq, select };
  }

  it('guarda solo la URL del libro en la hoja ya vinculada, sin tocar drive_id ni item_id', async () => {
    const { servicio, from, update, eq, select } = crear({ data: [{ id: 1 }], error: null });

    await servicio.vincularLibro('https://upb/Documents/Inventario.xlsx');

    expect(from).toHaveBeenCalledWith('sincronizacion_hoja');
    expect(update).toHaveBeenCalledWith({ url: 'https://upb/Documents/Inventario.xlsx' });
    expect(eq).toHaveBeenCalledWith('id', 1);
    expect(select).toHaveBeenCalledWith('id');
  });

  it('falla si no había ninguna hoja vinculada que actualizar', async () => {
    const { servicio } = crear({ data: [], error: null });
    await expectAsync(servicio.vincularLibro('https://upb/x.xlsx')).toBeRejectedWithError(/ninguna hoja vinculada/);
  });
});
