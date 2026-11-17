import {
  AsignacionIdWeb,
  duplicados,
  esListaDeAsignaciones,
  EstadoFila,
  verificarAsignaciones,
  verificarColumnaVacia,
} from './id-web';

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

  it('se detiene si el Excel se desplazó desde la copia', () => {
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

  it('trata un valor de error de Excel en la celda como vacío, igual que la copia importada', () => {
    const sinAutor = (fila: number, obraId: number, titulo: string): AsignacionIdWeb => ({
      fila, obraId, autor: null, titulo,
    });
    const r = verificarAsignaciones(
      [sinAutor(217, 900001, 'Cruz Típica de Lituania')],
      new Map([[217, { autor: '#VALUE!', titulo: 'Cruz Típica de Lituania', idWeb: '' }]])
    );
    expect(r).toEqual({ ok: true, pendientes: [sinAutor(217, 900001, 'Cruz Típica de Lituania')] });
  });

  it('se detiene si la celda destino tiene un error de Excel: hay una fórmula que no se sobrescribe', () => {
    const r = verificarAsignaciones([asignacion(2, 10, 'Uno')], new Map([[2, estado('Uno', '#REF!')]]));
    expect(r).toEqual({ ok: false, discrepancias: [{ fila: 2, motivo: 'ya tiene el ID WEB #REF!, se esperaba 10' }] });
  });

  it('se detiene si dos asignaciones repiten fila u obra, sin llegar a comparar con el Excel', () => {
    const r = verificarAsignaciones(
      [asignacion(2, 10, 'Uno'), asignacion(2, 11, 'Otra'), asignacion(3, 10, 'Dos')],
      new Map()
    );
    expect(r).toEqual({
      ok: false,
      discrepancias: [
        { fila: 2, motivo: 'la fila 2 aparece dos veces en id-web.json' },
        { fila: 2, motivo: 'la obra 10 aparece en dos filas' },
        { fila: 3, motivo: 'la obra 10 aparece en dos filas' },
      ],
    });
  });

  it('compara técnica y dimensión solo cuando la asignación las trae', () => {
    const conTecnica = (fila: number, obraId: number, tecnica: string, dimension: string): AsignacionIdWeb => ({
      fila, obraId, autor: 'Autor', titulo: 'Titulo', tecnica, dimension,
    });
    const estadoCompleto = (tecnica: unknown, dimension: unknown): EstadoFila => ({
      autor: 'Autor', titulo: 'Titulo', idWeb: '', tecnica, dimension,
    });

    const distinta = verificarAsignaciones(
      [conTecnica(2, 10, 'Óleo', '30x40')],
      new Map([[2, estadoCompleto('Acrílico', '30x40')]])
    );
    expect(distinta.ok).toBeFalse();

    const igual = verificarAsignaciones(
      [conTecnica(2, 10, 'Óleo', '30x40')],
      new Map([[2, estadoCompleto('Óleo', '30x40')]])
    );
    expect(igual).toEqual({ ok: true, pendientes: [conTecnica(2, 10, 'Óleo', '30x40')] });

    // id-web.json antiguo, sin tecnica/dimension: no se comparan aunque la hoja diga otra cosa.
    const sinCampos = verificarAsignaciones(
      [asignacion(2, 10, 'Titulo')],
      new Map([[2, estadoCompleto('Cualquiera', 'Cualquiera')]])
    );
    expect(sinCampos.ok).toBeTrue();
  });
});

describe('verificarColumnaVacia', () => {
  const asignacion2 = (obraId: number): AsignacionIdWeb => ({ fila: 2, obraId, autor: 'Autor', titulo: 'Titulo' });

  it('no informa nada si la celda destino está vacía', () => {
    const r = verificarColumnaVacia([asignacion2(10)], new Map([[2, estado('Titulo', '')]]), 'R');
    expect(r).toEqual([]);
  });

  it('no informa nada si la celda ya tiene exactamente el ID que se iba a escribir', () => {
    const r = verificarColumnaVacia([asignacion2(10)], new Map([[2, estado('Titulo', 10)]]), 'R');
    expect(r).toEqual([]);
  });

  it('informa la fila si la celda destino tiene un valor que no es el ID esperado', () => {
    const r = verificarColumnaVacia([asignacion2(10)], new Map([[2, estado('Titulo', 'texto suelto')]]), 'R');
    expect(r).toEqual([{ fila: 2, motivo: 'la columna R ya tiene un valor en la fila 2' }]);
  });

  it('informa también las filas sin asignación y los errores de Excel', () => {
    const r = verificarColumnaVacia(
      [asignacion2(10)],
      new Map([[2, estado('Titulo', '')], [3, estado('Otro', 'nota')], [4, estado('Otro', '#N/A')]]),
      'R'
    );
    expect(r.map((d) => d.fila)).toEqual([3, 4]);
  });
});

describe('duplicados', () => {
  it('sin repeticiones no informa nada', () => {
    expect(duplicados([asignacion(2, 10, 'Uno'), asignacion(3, 11, 'Dos')])).toEqual([]);
  });

  it('informa una fila repetida una sola vez', () => {
    expect(duplicados([asignacion(2, 10, 'Uno'), asignacion(2, 11, 'Otra')])).toEqual([
      { fila: 2, motivo: 'la fila 2 aparece dos veces en id-web.json' },
    ]);
  });

  it('informa cada fila de una obra que aparece dos veces', () => {
    expect(duplicados([asignacion(2, 10, 'Uno'), asignacion(3, 10, 'Dos')])).toEqual([
      { fila: 2, motivo: 'la obra 10 aparece en dos filas' },
      { fila: 3, motivo: 'la obra 10 aparece en dos filas' },
    ]);
  });
});

describe('esListaDeAsignaciones', () => {
  it('acepta el formato de id-web.json y rechaza lo demás', () => {
    expect(esListaDeAsignaciones([{ fila: 2, obraId: 10, autor: null, titulo: 'Uno' }])).toBeTrue();
    expect(esListaDeAsignaciones([{ fila: '2', obraId: 10 }])).toBeFalse();
    expect(esListaDeAsignaciones({})).toBeFalse();
  });

  it('acepta tecnica y dimension cuando vienen, y sigue aceptando un archivo antiguo sin ellas', () => {
    expect(
      esListaDeAsignaciones([{ fila: 2, obraId: 10, autor: null, titulo: 'Uno', tecnica: 'Óleo', dimension: '30x40' }])
    ).toBeTrue();
    expect(
      esListaDeAsignaciones([{ fila: 2, obraId: 10, autor: null, titulo: 'Uno', tecnica: null, dimension: null }])
    ).toBeTrue();
    expect(esListaDeAsignaciones([{ fila: 2, obraId: 10, autor: null, titulo: 'Uno' }])).toBeTrue();
    expect(
      esListaDeAsignaciones([{ fila: 2, obraId: 10, autor: null, titulo: 'Uno', tecnica: 5 }])
    ).toBeFalse();
  });
});
