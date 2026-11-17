import { TestBed, fakeAsync, tick } from '@angular/core/testing';
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

  it('fetch que nunca resuelve: tras el tope, lanza ErrorGraph 408', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValue(new Promise<Response>(() => {}));
    const graph = crearGraphService('token-cualquiera');

    let error: unknown;
    graph.tieneAccesoArchivos().catch((e) => (error = e));

    tick(15000);

    expect(error instanceof ErrorGraph).toBe(true);
    expect((error as ErrorGraph).estado).toBe(408);
    expect((error as ErrorGraph).message).toBe('Microsoft no respondió a tiempo. Vuelve a intentarlo.');
  }));
});

describe('GraphService.descargar', () => {
  it('pide la URL de descarga del archivo y la descarga sin enviar el token', async () => {
    const fetchEspia = spyOn(window, 'fetch').and.returnValues(
      Promise.resolve(new Response(JSON.stringify({ '@microsoft.graph.downloadUrl': 'https://descarga.test/x' }), { status: 200 })),
      Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    );
    const graph = crearGraphService('token');

    const datos = await graph.descargar('drive-1', 'item-1');

    expect(Array.from(datos)).toEqual([1, 2, 3]);
    expect(fetchEspia.calls.argsFor(0)[0]).toBe('https://graph.microsoft.com/v1.0/drives/drive-1/items/item-1');
    expect(fetchEspia.calls.argsFor(1)[0]).toBe('https://descarga.test/x');
    expect((fetchEspia.calls.argsFor(1)[1] as RequestInit).headers).toBeUndefined();
  });

  it('falla con un error claro si OneDrive no da URL de descarga', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({}), { status: 200 }));
    const graph = crearGraphService('token');

    await expectAsync(graph.descargar('drive-1', 'item-1')).toBeRejectedWithError(ErrorGraph, /URL de descarga/);
  });
});

describe('GraphService.leerRangoUsado', () => {
  it('pide la dirección, los valores y las fórmulas del rango usado de la pestaña', async () => {
    const respuesta = { address: "'Inventario Obras'!A1:R3", values: [['a']], formulas: [['a']] };
    const fetchEspia = spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(respuesta), { status: 200 }));
    const graph = crearGraphService('token');

    expect(await graph.leerRangoUsado('drive-1', 'item-1', 'Inventario Obras')).toEqual(respuesta);
    expect(fetchEspia.calls.argsFor(0)[0]).toBe(
      'https://graph.microsoft.com/v1.0/drives/drive-1/items/item-1/workbook/worksheets/Inventario%20Obras/usedRange?$select=address,values,formulas'
    );
  });
});

describe('GraphService: token de Microsoft en memoria', () => {
  type Sesion = { provider_token?: string; expires_at?: number; expires_in?: number } | null;
  let sesion: Sesion;
  const ahora = () => Math.floor(Date.now() / 1000);

  function montar(): GraphService {
    TestBed.configureTestingModule({
      providers: [{
        provide: SupabaseService,
        useValue: { supabaseClient: { auth: { getSession: async () => ({ data: { session: sesion } }) } } },
      }],
    });
    return TestBed.inject(GraphService);
  }

  it('sigue usando el token aunque un refresco de la sesión lo quite', async () => {
    sesion = { provider_token: 'token-1', expires_at: ahora() + 3600, expires_in: 3600 };
    const graph = montar();
    expect(await graph.token()).toBe('token-1');

    sesion = { expires_at: ahora() + 3600, expires_in: 3600 };

    expect(await graph.token()).toBe('token-1');
  });

  it('un token nuevo en la sesión sustituye al guardado', async () => {
    sesion = { provider_token: 'token-1', expires_at: ahora() + 3600, expires_in: 3600 };
    const graph = montar();
    await graph.token();

    sesion = { provider_token: 'token-2', expires_at: ahora() + 3600, expires_in: 3600 };

    expect(await graph.token()).toBe('token-2');
  });

  it('al cerrar sesión olvida el token guardado', async () => {
    sesion = { provider_token: 'token-1', expires_at: ahora() + 3600, expires_in: 3600 };
    const graph = montar();
    await graph.token();

    sesion = null;

    expect(await graph.token()).toBeNull();
  });

  it('calcula los minutos que le quedan desde que se emitió', async () => {
    sesion = { provider_token: 'token-1', expires_at: ahora() + 1800, expires_in: 3600 };
    const graph = montar();

    expect(Math.round(await graph.minutosRestantes())).toBe(30);
  });

  it('sin token le quedan 0 minutos', async () => {
    sesion = { expires_at: ahora() + 3600, expires_in: 3600 };
    const graph = montar();

    expect(await graph.minutosRestantes()).toBe(0);
  });
});

describe('GraphService.buscarArchivos', () => {
  it('sigue las páginas de resultados y se queda con los .xlsx', async () => {
    const respuesta = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200 });
    const archivo = (name: string) => ({ id: name, name, eTag: 'e', parentReference: { driveId: 'd' } });
    spyOn(window, 'fetch').and.returnValues(
      Promise.resolve(respuesta({ value: [archivo('Hoja de vida.pdf')], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/siguiente' })),
      Promise.resolve(respuesta({ value: [archivo('Inventario PRUEBA completo.xlsx')] }))
    );
    const graph = crearGraphService('token');

    const encontrados = await graph.buscarArchivos('Inventario');

    expect(encontrados.map((a) => a.name)).toEqual(['Inventario PRUEBA completo.xlsx']);
    expect((window.fetch as jasmine.Spy).calls.argsFor(1)[0]).toBe('https://graph.microsoft.com/v1.0/siguiente');
  });
});

describe('GraphService: mensajes de error de Graph', () => {
  const descargarCon = async (respuesta: Response): Promise<ErrorGraph> => {
    spyOn(window, 'fetch').and.resolveTo(respuesta);
    try {
      await crearGraphService('token-cualquiera').descargar('d', 'i');
    } catch (e) {
      return e as ErrorGraph;
    }
    throw new Error('debía lanzar ErrorGraph');
  };

  it('un 403 explica que la hoja es de otra persona y remite al complemento, sin el JSON de Microsoft', async () => {
    const e = await descargarCon(new Response('{"error":{"code":"accessDenied","message":"Access denied"}}', { status: 403 }));
    expect(e.estado).toBe(403);
    expect(e.message).toContain('complemento de Excel');
    expect(e.message).not.toContain('accessDenied');
  });

  it('otro error conserva el código de Graph y el estado para poder diagnosticarlo', async () => {
    const e = await descargarCon(new Response('{"error":{"code":"generalException"}}', { status: 500 }));
    expect(e.message).toBe('OneDrive respondió con un error (generalException, código 500).');
  });

  it('un cuerpo que no es JSON no rompe el mensaje', async () => {
    const e = await descargarCon(new Response('boom', { status: 502 }));
    expect(e.message).toBe('OneDrive respondió con un error (código 502).');
  });
});
