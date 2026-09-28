import { AsignacionIdWeb, esListaDeAsignaciones, EstadoFila, verificarAsignaciones } from './id-web';

const asignacion = (fila: number, obraId: number, titulo: string): AsignacionIdWeb => ({ fila, obraId, autor: 'Autor', titulo });
const estado = (titulo: unknown, idWeb: unknown = ''): EstadoFila => ({ autor: 'Autor', titulo, idWeb });

describe('verificarAsignaciones', () => {
  it('devuelve como pendientes las filas que coinciden y aún no tienen ID', () => {
    const r = verificarAsignaciones(
      [asignacion(3, 11, 'Dos'), asignacion(2, 10, 'Uno')],
      new Map([[2, estado('Uno')], [3, estado(' Dos ')]])
    );
    expect(r).toEqual({ ok: true, pendientes: [asignacion(2, 10, 'Uno'), asignacion(3, 11, 'Dos')] });
  });

  it('se detiene si la hoja se desplazó desde la copia', () => {
    const r = verificarAsignaciones(
      [asignacion(2, 10, 'Uno'), asignacion(3, 11, 'Dos')],
      new Map([[2, estado('Fila insertada')], [3, estado('Uno')]])
    );
    expect(r.ok).toBeFalse();
    if (!r.ok) expect(r.discrepancias.map((d) => d.fila)).toEqual([2, 3]);
  });

  it('omite las filas que ya tienen su ID, para poder repetir tras un corte', () => {
    const r = verificarAsignaciones(
      [asignacion(2, 10, 'Uno'), asignacion(3, 11, 'Dos')],
      new Map([[2, estado('Uno', 10)], [3, estado('Dos', '')]])
    );
    expect(r).toEqual({ ok: true, pendientes: [asignacion(3, 11, 'Dos')] });
  });

  it('se detiene si una fila ya tiene otro ID', () => {
    const r = verificarAsignaciones([asignacion(2, 10, 'Uno')], new Map([[2, estado('Uno', 99)]]));
    expect(r).toEqual({ ok: false, discrepancias: [{ fila: 2, motivo: 'ya tiene el ID WEB 99, se esperaba 10' }] });
  });

  it('se detiene si falta una fila', () => {
    const r = verificarAsignaciones([asignacion(600, 10, 'Uno')], new Map());
    expect(r.ok).toBeFalse();
  });
});

describe('esListaDeAsignaciones', () => {
  it('acepta el formato de id-web.json y rechaza lo demás', () => {
    expect(esListaDeAsignaciones([{ fila: 2, obraId: 10, autor: null, titulo: 'Uno' }])).toBeTrue();
    expect(esListaDeAsignaciones([{ fila: '2', obraId: 10 }])).toBeFalse();
    expect(esListaDeAsignaciones({})).toBeFalse();
  });
});
