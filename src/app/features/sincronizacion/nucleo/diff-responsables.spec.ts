import { diffCargos } from './diff-responsables';
import { Par } from './diff-filas';
import { camposFoto, ValoresFoto } from './foto';
import { CamposObra, FilaHoja } from './hoja-obras';
import { camposVacios, filaHoja, obraBase } from './pruebas/fabricas';

const JOBANY = 'JOBANY ALONSO TOBON PEÑA';
const par = (fila: number, obraId: number, campos: Partial<CamposObra>, extra: Partial<FilaHoja> = {}): Par => ({
  fila: filaHoja(fila, campos, { idWeb: obraId, ...extra }),
  obra: obraBase(obraId, campos),
});
const fotoDe = (obraId: number, cargo: string): [number, ValoresFoto] => [
  obraId,
  camposFoto({ ...camposVacios(), responsable: JOBANY, cargo }),
];
const enBase = (cargo: string | null) => [{ id: 9, nombre: JOBANY, cargo }];
const fila = (n: number, obraId: number, cargo: string, combinada = false) => ({ fila: n, obraId, cargo, combinada });

describe('diffCargos', () => {
  it('un cargo cambiado en el Excel se propone una vez por persona, con todas sus filas', () => {
    const r = diffCargos(
      [par(2, 1, { responsable: JOBANY, cargo: 'DIRECTOR' }), par(3, 2, { responsable: JOBANY, cargo: 'DIRECTOR' })],
      enBase('COORDINADOR'),
      new Map([fotoDe(1, 'COORDINADOR'), fotoDe(2, 'COORDINADOR')])
    );
    expect(r.cargos).toEqual([
      {
        clave: JOBANY, nombre: JOBANY, destino: 'base', hoja: 'DIRECTOR', base: 'COORDINADOR', foto: 'COORDINADOR',
        filas: [fila(2, 1, 'DIRECTOR'), fila(3, 2, 'DIRECTOR')],
      },
    ]);
  });

  it('un cargo cambiado en la web se escribe en todas las filas de la persona', () => {
    const r = diffCargos(
      [par(2, 1, { responsable: JOBANY, cargo: 'COORDINADOR' }), par(3, 2, { responsable: JOBANY, cargo: 'COORDINADOR' })],
      enBase('DIRECTOR'),
      new Map([fotoDe(1, 'COORDINADOR'), fotoDe(2, 'COORDINADOR')])
    );
    expect(r.cargos.map((c) => [c.destino, c.filas.length])).toEqual([['hoja', 2]]);
  });

  it('dos filas de la misma persona con cargos distintos son un conflicto de persona', () => {
    const r = diffCargos(
      [par(2, 1, { responsable: JOBANY, cargo: 'DIRECTOR' }), par(3, 2, { responsable: JOBANY, cargo: 'COORDINADOR' })],
      enBase('COORDINADOR'),
      new Map([fotoDe(1, 'COORDINADOR'), fotoDe(2, 'COORDINADOR')])
    );
    expect(r.cargos).toEqual([]);
    expect(r.conflictosCargo.map((c) => c.opciones)).toEqual([['DIRECTOR', 'COORDINADOR']]);
  });

  it('un conflicto de persona con un CARGO combinado avisa de esa celda, que no se podrá escribir', () => {
    const r = diffCargos(
      [
        par(2, 1, { responsable: JOBANY, cargo: 'DIRECTOR' }),
        par(3, 2, { responsable: JOBANY, cargo: 'COORDINADOR' }, { combinados: ['cargo'] }),
      ],
      enBase('COORDINADOR'),
      new Map([fotoDe(1, 'COORDINADOR'), fotoDe(2, 'COORDINADOR')])
    );
    expect(r.conflictosCargo.length).toBe(1);
    expect(r.avisos).toEqual([{ tipo: 'celda_combinada', obraId: 2, fila: 3, campo: 'cargo' }]);
  });

  it('si los dos lados cambiaron a valores distintos es un conflicto con las dos opciones', () => {
    const r = diffCargos(
      [par(2, 1, { responsable: JOBANY, cargo: 'DIRECTOR' })],
      enBase('RECTOR'),
      new Map([fotoDe(1, 'COORDINADOR')])
    );
    expect(r.conflictosCargo).toEqual([
      { clave: JOBANY, nombre: JOBANY, opciones: ['DIRECTOR', 'RECTOR'], base: 'RECTOR', foto: 'COORDINADOR', filas: [fila(2, 1, 'DIRECTOR')] },
    ]);
  });

  it('sin cambios no propone nada', () => {
    const r = diffCargos([par(2, 1, { responsable: JOBANY, cargo: 'COORDINADOR' })], enBase('COORDINADOR'), new Map([fotoDe(1, 'COORDINADOR')]));
    expect(r).toEqual({ cargos: [], conflictosCargo: [], convergencias: [], avisos: [] });
  });

  it('avisa de un cargo sin responsable', () => {
    const r = diffCargos([par(4, 3, { cargo: 'RECTOR' })], enBase('COORDINADOR'), new Map());
    expect(r.avisos).toEqual([{ tipo: 'cargo_sin_responsable', obraId: 3, fila: 4 }]);
  });

  it('ignora a las personas que no existen en la base: se crean al reasignar la obra', () => {
    const r = diffCargos([par(2, 1, { responsable: 'NUEVA PERSONA', cargo: 'RECTOR' })], enBase('COORDINADOR'), new Map());
    expect(r).toEqual({ cargos: [], conflictosCargo: [], convergencias: [], avisos: [] });
  });

  it('no escribe el cargo en una celda combinada: la deja fuera y avisa', () => {
    const r = diffCargos(
      [
        par(2, 1, { responsable: JOBANY, cargo: 'COORDINADOR' }),
        par(3, 2, { responsable: JOBANY, cargo: 'COORDINADOR' }, { combinados: ['cargo'] }),
      ],
      enBase('DIRECTOR'),
      new Map([fotoDe(1, 'COORDINADOR'), fotoDe(2, 'COORDINADOR')])
    );
    expect(r.cargos[0].filas).toEqual([fila(2, 1, 'COORDINADOR')]);
    expect(r.avisos).toEqual([{ tipo: 'celda_combinada', obraId: 2, fila: 3, campo: 'cargo' }]);
  });
});
