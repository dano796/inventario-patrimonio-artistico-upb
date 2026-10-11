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
