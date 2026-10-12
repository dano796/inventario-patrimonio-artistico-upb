import { TestBed } from '@angular/core/testing';
import { TableroService } from './tablero.service';
import { SupabaseService } from '../../core/services/supabase.service';

describe('TableroService', () => {
  it('lee obras_admin por páginas y cuenta las imágenes de cada obra', async () => {
    const fila = {
      id: 14, titulo: 'Paisaje', autor: null, tecnica: 'Óleo', ubicacion: 'Bloque 6', responsable: null,
      fecha_creacion: '2026-10-10T15:00:00Z', imagenes: [{ id: 1 }, { id: 2 }],
    };
    const range = jasmine.createSpy('range').and.returnValues(
      Promise.resolve({ data: [fila], error: null }),
      Promise.resolve({ data: [], error: null })
    );
    const order = jasmine.createSpy('order').and.returnValue({ range });
    const select = jasmine.createSpy('select').and.returnValue({ order });
    const from = jasmine.createSpy('from').and.returnValue({ select });
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabaseClient: { from }, ensureActiveSession: async () => true } }],
    });

    const obras = await TestBed.inject(TableroService).obras();

    expect(from).toHaveBeenCalledWith('obras_admin');
    expect(select.calls.mostRecent().args[0]).toContain('imagenes(id)');
    expect(order).toHaveBeenCalledWith('id');
    expect(obras).toEqual([
      {
        id: 14, titulo: 'Paisaje', autor: null, tecnica: 'Óleo', ubicacion: 'Bloque 6', responsable: null,
        fechaCreacion: '2026-10-10T15:00:00Z', imagenes: 2,
      },
    ]);
  });

  it('lee la fecha de la última sincronización y cuenta las obras editadas desde entonces', async () => {
    const gt = jasmine.createSpy('gt').and.resolveTo({ count: 5, error: null });
    const maybeSingle = jasmine.createSpy('maybeSingle').and.resolveTo({ data: { fecha_ultima: '2026-10-09T10:00:00Z' }, error: null });
    const select = jasmine.createSpy('select').and.callFake((columnas: string) => (columnas === 'fecha_ultima' ? { maybeSingle } : { gt }));
    const from = jasmine.createSpy('from').and.returnValue({ select });
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabaseClient: { from }, ensureActiveSession: async () => true } }],
    });

    const estado = await TestBed.inject(TableroService).estadoSincronizacion();

    expect(from.calls.allArgs()).toEqual([['sincronizacion_hoja'], ['obras']]);
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(gt).toHaveBeenCalledWith('fecha_actualizacion', '2026-10-09T10:00:00Z');
    expect(estado).toEqual({ fechaUltima: '2026-10-09T10:00:00Z', editadas: 5 });
  });

  it('si nunca se sincronizó no cuenta nada', async () => {
    const maybeSingle = jasmine.createSpy('maybeSingle').and.resolveTo({ data: null, error: null });
    const from = jasmine.createSpy('from').and.returnValue({ select: () => ({ maybeSingle }) });
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { supabaseClient: { from }, ensureActiveSession: async () => true } }],
    });

    expect(await TestBed.inject(TableroService).estadoSincronizacion()).toEqual({ fechaUltima: null, editadas: 0 });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
