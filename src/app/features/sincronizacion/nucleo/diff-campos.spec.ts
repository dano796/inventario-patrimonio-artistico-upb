import { compararCampo, diffCamposObra } from './diff-campos';
import { camposFoto } from './foto';
import { CamposObra } from './hoja-obras';
import { camposVacios, filaHoja, obraBase } from './pruebas/fabricas';

const foto = (campos: Partial<CamposObra>) => camposFoto({ ...camposVacios(), ...campos });

describe('compararCampo', () => {
  it('aplica la tabla de las tres copias', () => {
    expect(compararCampo('ubicacion', 'Bloque 6', 'Bloque 6', 'Bloque 6')).toEqual({ tipo: 'igual' });
    expect(compararCampo('ubicacion', 'Bloque 11', 'Bloque 6', 'Bloque 6')).toEqual({ tipo: 'cambio', destino: 'base' });
    expect(compararCampo('ubicacion', 'Bloque 6', 'Bloque 3', 'Bloque 6')).toEqual({ tipo: 'cambio', destino: 'hoja' });
    expect(compararCampo('ubicacion', 'Bloque 11', 'Bloque 3', 'Bloque 6')).toEqual({ tipo: 'conflicto' });
  });

  it('si los dos lados cambiaron al mismo valor, solo hay que poner al día la foto', () => {
    expect(compararCampo('ubicacion', 'Bloque 11', ' Bloque  11', 'Bloque 6')).toEqual({
      tipo: 'convergido',
      valor: 'Bloque 11',
    });
  });

  it('«No registra», vacío y NULL son lo mismo', () => {
    expect(compararCampo('descripcion', 'No registra', null, null)).toEqual({ tipo: 'igual' });
  });

  it('sin foto, lo distinto es conflicto y lo igual crea la foto', () => {
    expect(compararCampo('titulo', 'Uno', 'Dos', undefined)).toEqual({ tipo: 'conflicto' });
    expect(compararCampo('titulo', 'Uno', 'Uno', undefined)).toEqual({ tipo: 'convergido', valor: 'Uno' });
  });
});

describe('diffCamposObra', () => {
  it('compara por campo: un cambio en cada lado son dos cambios, no un conflicto', () => {
    const r = diffCamposObra(
      filaHoja(2, { titulo: 'Paisaje', ubicacion: 'Bloque 11', observaciones: 'Nota' }),
      obraBase(14, { titulo: 'Paisaje', ubicacion: 'Bloque 6', observaciones: 'Nota corregida' }),
      foto({ titulo: 'Paisaje', ubicacion: 'Bloque 6', observaciones: 'Nota' })
    );
    expect(r.cambios).toEqual([
      { obraId: 14, fila: 2, campo: 'ubicacion', destino: 'base', hoja: 'Bloque 11', base: 'Bloque 6', foto: 'Bloque 6' },
      { obraId: 14, fila: 2, campo: 'observaciones', destino: 'hoja', hoja: 'Nota', base: 'Nota corregida', foto: 'Nota' },
    ]);
    expect(r.conflictos).toEqual([]);
  });

  it('reporta el conflicto con el valor de la foto', () => {
    const r = diffCamposObra(
      filaHoja(5, { ubicacion: 'Bloque 11' }),
      obraBase(31, { ubicacion: 'Bloque 3' }),
      foto({ ubicacion: 'Bloque 6' })
    );
    expect(r.conflictos).toEqual([
      { obraId: 31, fila: 5, campo: 'ubicacion', hoja: 'Bloque 11', base: 'Bloque 3', foto: 'Bloque 6' },
    ]);
  });

  it('salta los campos que la hoja no pudo convertir', () => {
    const r = diffCamposObra(
      filaHoja(3, { valor: null }, { noConvertibles: ['valor'] }),
      obraBase(7, { valor: 900000 }),
      foto({ valor: 900000 })
    );
    expect(r.cambios).toEqual([]);
  });

  it('una celda combinada que la web cambió es un aviso, no una escritura', () => {
    const r = diffCamposObra(
      filaHoja(130, { valor: 800000 }, { combinados: ['valor'] }),
      obraBase(40, { valor: 950000 }),
      foto({ valor: 800000 })
    );
    expect(r.cambios).toEqual([]);
    expect(r.avisos).toEqual([{ tipo: 'celda_combinada', obraId: 40, fila: 130, campo: 'valor' }]);
  });

  it('una celda combinada en conflicto también es un aviso', () => {
    const r = diffCamposObra(
      filaHoja(130, { valor: 700000 }, { combinados: ['valor'] }),
      obraBase(40, { valor: 950000 }),
      foto({ valor: 800000 })
    );
    expect(r.conflictos).toEqual([]);
    expect(r.avisos.length).toBe(1);
  });

  it('una celda combinada cambiada en la hoja sí se lleva a la base', () => {
    const r = diffCamposObra(
      filaHoja(130, { valor: 950000 }, { combinados: ['valor'] }),
      obraBase(40, { valor: 800000 }),
      foto({ valor: 800000 })
    );
    expect(r.cambios.map((c) => c.destino)).toEqual(['base']);
  });

  it('el cargo no se compara por obra: es de la persona', () => {
    const r = diffCamposObra(filaHoja(2, { cargo: 'RECTOR' }), obraBase(1, { cargo: 'DECANO' }), foto({ cargo: 'DECANO' }));
    expect(r.cambios).toEqual([]);
    expect(r.conflictos).toEqual([]);
  });

  it('sin foto, un campo igual en los dos lados se registra como convergencia', () => {
    const r = diffCamposObra(filaHoja(2, { titulo: 'Uno' }), obraBase(1, { titulo: 'Uno' }), undefined);
    expect(r.convergencias).toContain({ obraId: 1, clave: 'titulo', valor: 'Uno' });
  });
});
