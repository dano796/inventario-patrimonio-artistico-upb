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
});
