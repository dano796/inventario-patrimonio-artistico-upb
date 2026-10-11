import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ArtworksService } from './artworks.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { ImageService } from '../../../shared/services/image.service';

const FUERA_DE_RANGO = {
  code: 'PGRST103',
  message: 'Requested range not satisfiable',
  details: 'An offset of 696 was requested, but there are only 526 rows.',
};

function montar() {
  const rangos: [number, number][] = [];
  const consulta: Record<string, unknown> = {};
  for (const metodo of ['select', 'ilike', 'or', 'order', 'abortSignal', 'returns']) consulta[metodo] = () => consulta;
  consulta['range'] = (desde: number, hasta: number) => {
    rangos.push([desde, hasta]);
    return consulta;
  };
  consulta['then'] = (resolver: (r: unknown) => unknown) => {
    const [desde] = rangos[rangos.length - 1];
    const respuesta = desde >= 526 ? { data: null, error: FUERA_DE_RANGO, count: null } : { data: [], error: null, count: 526 };
    return Promise.resolve(respuesta).then(resolver);
  };
  const supabase = {
    supabaseClient: { from: () => consulta },
    ensureActiveSession: async () => true,
    refreshSession: async () => true,
    reinitializeClient: jasmine.createSpy('reinitializeClient'),
    pauseHeartbeat: () => undefined,
    resumeHeartbeat: () => undefined,
    markActivity: () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: supabase },
      { provide: AuthService, useValue: { isAdmin: signal(true) } },
      { provide: ImageService, useValue: {} },
    ],
  });
  return { servicio: TestBed.inject(ArtworksService), rangos, supabase };
}

describe('ArtworksService', () => {
  it('una página fuera de rango vuelve a la primera en lugar de dar error', async () => {
    const { servicio, rangos, supabase } = montar();
    await servicio.filterArtworks({}, 30);
    expect(servicio.error()).toBeFalse();
    expect(servicio.currentPage()).toBe(1);
    expect(rangos).toEqual([[696, 719], [0, 23]]);
    expect(supabase.reinitializeClient).not.toHaveBeenCalled();
  });
});

function montarConSesionesManuales() {
  const sesiones: (() => void)[] = [];
  const desde = () => {
    let inicio = 0;
    let senal: AbortSignal | undefined;
    const consulta: Record<string, unknown> = {};
    for (const metodo of ['select', 'ilike', 'or', 'order', 'returns']) consulta[metodo] = () => consulta;
    consulta['range'] = (a: number) => ((inicio = a), consulta);
    consulta['abortSignal'] = (s: AbortSignal) => ((senal = s), consulta);
    consulta['then'] = (resolver: (r: unknown) => unknown) => {
      const respuesta = senal?.aborted
        ? { data: null, error: { name: 'AbortError', message: 'aborted' }, count: null }
        : { data: [{ id: inicio === 0 ? 1 : 2 }], error: null, count: 48 };
      return Promise.resolve(respuesta).then(resolver);
    };
    return consulta;
  };
  const supabase = {
    supabaseClient: { from: desde },
    ensureActiveSession: () => new Promise<boolean>((r) => sesiones.push(() => r(true))),
    refreshSession: async () => true,
    reinitializeClient: jasmine.createSpy('reinitializeClient'),
    pauseHeartbeat: () => undefined,
    resumeHeartbeat: () => undefined,
    markActivity: () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: supabase },
      { provide: AuthService, useValue: { isAdmin: signal(true) } },
      { provide: ImageService, useValue: {} },
    ],
  });
  return { servicio: TestBed.inject(ArtworksService), sesiones };
}

describe('ArtworksService con cargas solapadas', () => {
  it('la carga anterior se cancela con su propio controlador y no deja sin él a la nueva', async () => {
    const { servicio, sesiones } = montarConSesionesManuales();
    const primera = servicio.getAllArtworks({ page: 1 });
    const segunda = servicio.getAllArtworks({ page: 2 });
    await Promise.resolve();
    sesiones[0]();
    await primera;
    sesiones[1]();
    await segunda;
    expect(servicio.error()).toBeFalse();
    expect(servicio.artworks().map((o) => o.id)).toEqual([2]);
    expect(servicio.currentPage()).toBe(2);
  });
});
