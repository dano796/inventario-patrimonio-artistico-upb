import { emparejar, ObraExistente, validarEmparejamiento } from './emparejamiento';
import { CAMPOS, CamposObra, FilaHoja } from './hoja-obras';

function fila(numero: number, autor: string | null, titulo: string | null, idWeb: number | null = null): FilaHoja {
  const campos = Object.fromEntries(CAMPOS.map((c) => [c, null])) as unknown as CamposObra;
  return {
    fila: numero, idWeb, campos: { ...campos, autor, titulo },
    noConvertibles: [], combinados: [], heredados: [], imagenes: [],
  };
}
const obra = (id: number, autor: string | null, titulo: string | null): ObraExistente => ({ id, autor, titulo });

describe('emparejar', () => {
  it('empareja por autor y título sin importar acentos ni mayúsculas', () => {
    const r = emparejar([fila(2, 'Jorge Vélez', 'Bolívar')], [obra(20, 'JORGE VELEZ', 'bolivar')]);
    expect(r.emparejamientos[0]).toEqual(jasmine.objectContaining({ obraId: 20, metodo: 'exacto', revisado: true }));
    expect(r.obrasSinFila).toEqual([]);
  });

  it('usa el ID WEB antes que cualquier otro criterio', () => {
    const r = emparejar([fila(2, 'Otro', 'Otro', 7)], [obra(7, 'A', 'B')]);
    expect(r.emparejamientos[0]).toEqual(jasmine.objectContaining({ obraId: 7, metodo: 'id-web' }));
  });

  it('no asigna a nadie una obra que reclaman dos filas, ni siquiera por título', () => {
    const r = emparejar(
      [fila(49, 'Jorge Vélez Bernal', 'Bolívar'), fila(50, 'Jorge Vélez Bernal', 'Bolívar'), fila(51, null, 'Bolívar')],
      [obra(20, 'Jorge Vélez Bernal', 'Bolívar')]
    );
    const [a, b, c] = r.emparejamientos;
    expect(a).toEqual(jasmine.objectContaining({ obraId: null, metodo: 'ambiguo', candidatos: [20], revisado: false }));
    expect(b).toEqual(jasmine.objectContaining({ obraId: null, metodo: 'ambiguo', candidatos: [20] }));
    expect(c.obraId).toBeNull();
    expect(r.obrasSinFila).toEqual([]);
  });

  it('rescata por título único, pero lo deja pendiente de revisar', () => {
    const r = emparejar([fila(194, 'Departamento Técnico', 'Plano Medellín futuro')], [obra(77, null, 'Plano Medellín futuro')]);
    expect(r.emparejamientos[0]).toEqual(jasmine.objectContaining({ obraId: 77, metodo: 'titulo', revisado: false }));
  });

  it('no empareja títulos genéricos solo por el título', () => {
    const r = emparejar([fila(31, 'Miler Lagos', 'Sin título')], [obra(58, null, 'Sin título')]);
    expect(r.emparejamientos[0]).toEqual(jasmine.objectContaining({ obraId: null, metodo: 'nueva' }));
    expect(r.obrasSinFila).toEqual([58]);
  });

  it('marca como nuevas las filas sin coincidencia', () => {
    const r = emparejar([fila(300, 'Nadie', 'Nada')], [obra(1, 'Otra', 'Cosa')]);
    expect(r.emparejamientos[0]).toEqual(jasmine.objectContaining({ metodo: 'nueva', revisado: true }));
    expect(r.obrasSinFila).toEqual([1]);
  });
});

describe('validarEmparejamiento', () => {
  const obras = [obra(1, 'A', 'B'), obra(2, 'C', 'D')];
  const base = { autor: null, titulo: null, candidatos: [], metodo: 'exacto' as const, revisado: true };

  it('exige revisar los emparejamientos pendientes', () => {
    expect(validarEmparejamiento([{ ...base, fila: 2, obraId: null, metodo: 'ambiguo', revisado: false }], obras))
      .toEqual(['Fila 2: falta revisar el emparejamiento (ambiguo)']);
  });

  it('rechaza obras inexistentes y obras asignadas a dos filas', () => {
    expect(validarEmparejamiento([
      { ...base, fila: 2, obraId: 1 },
      { ...base, fila: 3, obraId: 1 },
      { ...base, fila: 4, obraId: 99 },
    ], obras)).toEqual(['Filas 2 y 3: las dos apuntan a la obra 1', 'Fila 4: la obra 99 no existe']);
  });
});
