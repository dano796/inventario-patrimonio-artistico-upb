import { calcularTablero, ObraTablero } from './tablero';

const obra = (id: number, o: Partial<ObraTablero> = {}): ObraTablero => ({
  id, titulo: `Obra ${id}`, autor: 'Ana', tecnica: 'Óleo', ubicacion: 'Bloque 6', responsable: 'JOBANY',
  fechaCreacion: '2026-09-01T12:00:00Z', imagenes: 1, ...o,
});
const HOY = new Date(2026, 9, 11, 10, 42);

describe('calcularTablero', () => {
  it('cuenta el total y las obras creadas este mes', () => {
    const r = calcularTablero([obra(1), obra(2, { fechaCreacion: '2026-10-10T15:00:00Z' }), obra(3, { fechaCreacion: null })], HOY);
    expect([r.total, r.nuevasEsteMes]).toEqual([3, 1]);
  });

  it('una ficha incompleta es la que no tiene autor, técnica, responsable o imagen, y se cuenta una vez', () => {
    const r = calcularTablero(
      [obra(1), obra(2, { autor: null, imagenes: 0 }), obra(3, { tecnica: '  ' }), obra(4, { responsable: null })],
      HOY
    );
    expect([r.incompletas, r.porcentajeIncompletas, r.sinImagen]).toEqual([3, 75, 1]);
    expect(r.pendientes.autor.map((o) => o.id)).toEqual([2]);
    expect(r.pendientes.tecnica.map((o) => o.id)).toEqual([3]);
    expect(r.pendientes.responsable.map((o) => o.id)).toEqual([4]);
    expect(r.pendientes.imagen.map((o) => o.id)).toEqual([2]);
  });

  it('agrupa ubicaciones sin contar las vacías y ordena de más a menos obras', () => {
    const r = calcularTablero(
      [
        obra(1, { ubicacion: 'Bloque 6' }), obra(2, { ubicacion: ' Bloque  6 ' }), obra(3, { ubicacion: 'Biblioteca' }),
        obra(4, { ubicacion: null }), obra(5, { ubicacion: '   ' }), obra(6, { ubicacion: 'Auditorio' }),
      ],
      HOY
    );
    expect(r.ubicaciones).toBe(3);
    expect(r.porUbicacion).toEqual([
      { nombre: 'Bloque 6', obras: 2, proporcion: 1 },
      { nombre: 'Auditorio', obras: 1, proporcion: 0.5 },
      { nombre: 'Biblioteca', obras: 1, proporcion: 0.5 },
    ]);
  });

  it('muestra como mucho las siete ubicaciones con más obras', () => {
    const obras = Array.from({ length: 9 }, (_, i) => obra(i + 1, { ubicacion: `Sede ${i + 1}` }));
    const r = calcularTablero(obras, HOY);
    expect([r.ubicaciones, r.porUbicacion.length]).toEqual([9, 7]);
  });

  it('con el inventario vacío no divide por cero', () => {
    const r = calcularTablero([], HOY);
    expect([r.total, r.incompletas, r.porcentajeIncompletas, r.ubicaciones, r.porUbicacion.length]).toEqual([0, 0, 0, 0, 0]);
  });
});
