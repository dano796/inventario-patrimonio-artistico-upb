import { TestBed } from '@angular/core/testing';
import { leerPorPaginas, obraDesdeFila, SincronizacionDatosService } from './sincronizacion-datos.service';
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

describe('leerPorPaginas', () => {
  it('pide páginas hasta que una llega vacía', async () => {
    const paginas = [[1, 2], [3], []];
    const pedidas: [number, number][] = [];
    const filas = await leerPorPaginas<number>(async (desde, hasta) => {
      pedidas.push([desde, hasta]);
      return { data: paginas.shift() ?? [], error: null };
    });
    expect(filas).toEqual([1, 2, 3]);
    expect(pedidas).toEqual([[0, 999], [2, 1001], [3, 1002]]);
  });

  it('propaga el error de una página', async () => {
    await expectAsync(leerPorPaginas(async () => ({ data: null, error: new Error('sin permiso') }))).toBeRejectedWithError('sin permiso');
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
