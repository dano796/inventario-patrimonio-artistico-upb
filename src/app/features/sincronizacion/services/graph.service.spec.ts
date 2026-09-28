import { TestBed } from '@angular/core/testing';
import { GraphService, ErrorGraph } from './graph.service';
import { SupabaseService } from '../../../core/services/supabase.service';

function crearGraphService(providerToken: string | null): GraphService {
  const supabaseDouble = {
    supabaseClient: {
      auth: {
        getSession: async () => ({
          data: { session: providerToken ? { provider_token: providerToken } : null },
        }),
      },
    },
  };

  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: supabaseDouble }],
  });

  return TestBed.inject(GraphService);
}

describe('GraphService.tieneAccesoArchivos', () => {
  it('sin provider_token: no llama a fetch y devuelve false', async () => {
    spyOn(window, 'fetch');
    const graph = crearGraphService(null);

    const resultado = await graph.tieneAccesoArchivos();

    expect(resultado).toBe(false);
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('respuesta 200: devuelve true', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 200 }));
    const graph = crearGraphService('token-con-permiso');

    expect(await graph.tieneAccesoArchivos()).toBe(true);
  });

  it('respuesta 401: devuelve false', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 401 }));
    const graph = crearGraphService('token-sin-permiso');

    expect(await graph.tieneAccesoArchivos()).toBe(false);
  });

  it('respuesta 403: devuelve false', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 403 }));
    const graph = crearGraphService('token-sin-permiso');

    expect(await graph.tieneAccesoArchivos()).toBe(false);
  });

  it('respuesta 500: lanza ErrorGraph con ese estado', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('boom', { status: 500 }));
    const graph = crearGraphService('token-cualquiera');

    try {
      await graph.tieneAccesoArchivos();
      fail('debía lanzar ErrorGraph');
    } catch (e) {
      expect(e instanceof ErrorGraph).toBe(true);
      expect((e as ErrorGraph).estado).toBe(500);
    }
  });
});
