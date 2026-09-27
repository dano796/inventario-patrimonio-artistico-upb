import { Emparejamiento } from './emparejamiento';
import { valoresFoto } from './foto';
import { CAMPOS, CamposObra, CasillaImagen, FilaHoja } from './hoja-obras';
import { EntradaImportacion, LIMITE_IMAGEN, ObraBase, planificarImportacion } from './importacion';
import { MOTIVO_OTRA_MONEDA } from './normalizacion';

const vacios = () => Object.fromEntries(CAMPOS.map((c) => [c, null])) as unknown as CamposObra;
const fila = (numero: number, campos: Partial<CamposObra>, extra: Partial<FilaHoja> = {}): FilaHoja => ({
  fila: numero, idWeb: null, campos: { ...vacios(), ...campos },
  noConvertibles: [], combinados: [], imagenes: [{ tipo: 'vacia' }, { tipo: 'vacia' }, { tipo: 'vacia' }], ...extra,
});
const obra = (id: number, campos: Partial<CamposObra>, imagenes: { id: number; url: string }[] = []): ObraBase => ({
  id, campos: { ...vacios(), ...campos }, imagenes,
});
const par = (numero: number, obraId: number | null): Emparejamiento => ({
  fila: numero, autor: null, titulo: null, obraId, metodo: obraId ? 'exacto' : 'nueva', candidatos: [], revisado: true,
});
const planDe = (e: Partial<EntradaImportacion>) =>
  planificarImportacion({ filas: [], avisos: [], emparejamientos: [], obras: [], obrasSinFila: [], ...e });

describe('planificarImportacion', () => {
  it('actualiza solo los campos que difieren tras normalizar', () => {
    const plan = planDe({
      filas: [fila(2, { titulo: 'Paisaje', ubicacion: 'Bloque 11', tecnica: 'Óleo  sobre tela' })],
      emparejamientos: [par(2, 5)],
      obras: [obra(5, { titulo: 'Paisaje', ubicacion: 'Bloque 6', tecnica: 'Óleo sobre tela' })],
    });
    expect(plan.actualizaciones).toEqual([
      { fila: 2, obraId: 5, valores: { ubicacion: 'Bloque 11' }, cambios: [{ campo: 'ubicacion', base: 'Bloque 6', hoja: 'Bloque 11' }] },
    ]);
    expect(plan.altas).toEqual([]);
  });

  it('respeta las excepciones marcadas en la revisión', () => {
    const plan = planDe({
      filas: [fila(2, { titulo: 'Paisaje', ubicacion: 'Bloque 11' })],
      emparejamientos: [par(2, 5)],
      obras: [obra(5, { titulo: 'Paisaje', ubicacion: 'Bloque 6' })],
      excepciones: [{ obraId: 5, campo: 'ubicacion' }],
    });
    expect(plan.actualizaciones).toEqual([]);
  });

  it('da de alta las filas sin obra', () => {
    const plan = planDe({ filas: [fila(300, { titulo: 'Nueva' })], emparejamientos: [par(300, null)] });
    expect(plan.altas).toEqual([{ fila: 300, valores: { ...vacios(), titulo: 'Nueva' } }]);
  });

  it('deja el valor en otra moneda vacío y lo anota en observaciones', () => {
    const f = fila(212, { titulo: 'Obra', observaciones: 'Donación' }, { noConvertibles: ['valor'] });
    const plan = planDe({
      filas: [f],
      avisos: [{ fila: 212, campo: 'valor', motivo: MOTIVO_OTRA_MONEDA, original: 'USD 5,000' }],
      emparejamientos: [par(212, null)],
    });
    expect(plan.altas[0].valores.valor).toBeNull();
    expect(plan.altas[0].valores.observaciones).toBe('Donación\nValor original: USD 5,000');
  });

  it('no toca en la base un campo que no se pudo convertir', () => {
    const plan = planDe({
      filas: [fila(2, { titulo: 'Obra', ano: null }, { noConvertibles: ['ano'] })],
      emparejamientos: [par(2, 5)],
      obras: [obra(5, { titulo: 'Obra', ano: 1950 })],
    });
    expect(plan.actualizaciones).toEqual([]);
  });

  it('importa las imágenes solo de obras que no tienen ninguna, y rechaza las que el bucket no admite', () => {
    const imagenes: CasillaImagen[] = [
      { tipo: 'pegada', archivo: 'xl/media/image1.jpeg' },
      { tipo: 'pegada', archivo: 'xl/media/image2.emf' },
      { tipo: 'pegada', archivo: 'xl/media/image3.png' },
    ];
    const plan = planDe({
      filas: [fila(2, { titulo: 'Con' }, { imagenes }), fila(3, { titulo: 'Sin' }, { imagenes })],
      emparejamientos: [par(2, 5), par(3, null)],
      obras: [obra(5, { titulo: 'Con' }, [{ id: 80, url: 'https://x/a.jpg' }])],
      tamanos: { 'xl/media/image3.png': LIMITE_IMAGEN + 1 },
    });
    expect(plan.imagenes).toEqual([{ fila: 3, obraId: null, casilla: 1, archivo: 'xl/media/image1.jpeg' }]);
    expect(plan.imagenesRechazadas.map((r) => r.motivo)).toEqual([
      'formato no admitido por el bucket',
      'supera los 5 MB del bucket',
    ]);
  });

  it('no borra en la base un campo que la hoja trae vacío', () => {
    const plan = planDe({
      filas: [fila(2, { titulo: 'Obra', observaciones: null })],
      emparejamientos: [par(2, 5)],
      obras: [obra(5, { titulo: 'Obra', observaciones: 'Busto de mujer' })],
    });
    expect(plan.actualizaciones).toEqual([]);
    expect(plan.conservados).toEqual([{ fila: 2, obraId: 5, campo: 'observaciones' }]);
  });

  it('conserva el campo vacío y a la vez actualiza los demás que sí difieren', () => {
    const plan = planDe({
      filas: [fila(2, { titulo: 'Obra', observaciones: null, ubicacion: 'Bloque 11' })],
      emparejamientos: [par(2, 5)],
      obras: [obra(5, { titulo: 'Obra', observaciones: 'Busto de mujer', ubicacion: 'Bloque 6' })],
    });
    expect(plan.actualizaciones).toEqual([
      { fila: 2, obraId: 5, valores: { ubicacion: 'Bloque 11' }, cambios: [{ campo: 'ubicacion', base: 'Bloque 6', hoja: 'Bloque 11' }] },
    ]);
    expect(plan.conservados).toEqual([{ fila: 2, obraId: 5, campo: 'observaciones' }]);
  });

  it('la excepción de otra moneda sigue vaciando el valor en una obra emparejada', () => {
    const f = fila(2, { titulo: 'Obra', valor: null }, { noConvertibles: ['valor'] });
    const plan = planDe({
      filas: [f],
      avisos: [{ fila: 2, campo: 'valor', motivo: MOTIVO_OTRA_MONEDA, original: 'USD 5,000' }],
      emparejamientos: [par(2, 5)],
      obras: [obra(5, { titulo: 'Obra', valor: 1200000, observaciones: 'Valor original: USD 5,000' })],
    });
    expect(plan.actualizaciones).toEqual([
      { fila: 2, obraId: 5, valores: { valor: null }, cambios: [{ campo: 'valor', base: 1200000, hoja: null }] },
    ]);
    expect(plan.conservados).toEqual([]);
  });

  it('reúne los responsables por nombre normalizado y detecta cargos distintos', () => {
    const plan = planDe({
      filas: [
        fila(2, { responsable: 'Lina María Cardona Gallo', cargo: 'Gestión de contenidos' }),
        fila(3, { responsable: 'LINA MARÍA CARDONA GALLO', cargo: 'Gestión de contenidos' }),
        fila(4, { responsable: 'Diego Estrada', cargo: 'CAPELLAN' }),
        fila(5, { responsable: 'DIEGO ESTRADA', cargo: 'RECTOR' }),
      ],
      emparejamientos: [par(2, null), par(3, null), par(4, null), par(5, null)],
    });
    expect(plan.responsables).toEqual([
      { clave: 'LINA MARÍA CARDONA GALLO', nombre: 'Lina María Cardona Gallo', cargo: 'Gestión de contenidos' },
      { clave: 'DIEGO ESTRADA', nombre: 'Diego Estrada', cargo: 'CAPELLAN' },
    ]);
    expect(plan.cargosEnConflicto).toEqual([{ nombre: 'Diego Estrada', cargos: ['CAPELLAN', 'RECTOR'], filas: [4, 5] }]);
  });
});

describe('valoresFoto', () => {
  it('guarda los campos normalizados y siempre tres casillas de imagen', () => {
    const foto = valoresFoto({ ...vacios(), titulo: ' Retrato  del Fundador ', responsable: 'lina maría', valor: 1200000 }, [80]);
    expect(foto['titulo']).toBe('Retrato del Fundador');
    expect(foto['responsable']).toBe('LINA MARÍA');
    expect(foto['valor']).toBe(1200000);
    expect([foto['imagen_1'], foto['imagen_2'], foto['imagen_3']]).toEqual([80, null, null]);
  });
});
