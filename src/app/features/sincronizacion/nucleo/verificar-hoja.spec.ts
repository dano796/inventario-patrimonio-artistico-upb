import {
  agruparEnBloques, bloqueDeAltas, ColumnasHoja, columnasDeEncabezados, lecturaDesdeRango, MOTIVO_CELDA_CAMBIADA,
  MOTIVO_ID_REPETIDO, MOTIVO_SIN_FILA, origenDeDireccion, ubicarEscrituras, ubicarIdsNuevos,
} from './verificar-hoja';
import { EscrituraHoja } from './plan-ejecucion';
import { ENCABEZADOS_HOJA, FilaDePrueba, rangoDePrueba } from './pruebas/rango-de-prueba';
import { filaHoja } from './pruebas/fabricas';

const PREFIJO = 'https://x.supabase.co/storage/v1/object/public/imagenes-obras/';
const columnas = (): ColumnasHoja => {
  const c = columnasDeEncabezados(ENCABEZADOS_HOJA);
  if ('faltantes' in c) throw new Error(c.faltantes.join(', '));
  return c;
};
const lectura = (filas: FilaDePrueba[]) => {
  const r = rangoDePrueba(filas);
  return lecturaDesdeRango(r.values, r.formulas, columnas().idWeb, origenDeDireccion(r.address));
};
const escritura = (e: Partial<EscrituraHoja> = {}): EscrituraHoja => ({
  obraId: 14, fila: 2, destino: { tipo: 'campo', campo: 'ubicacion' }, valor: 'Bloque 3', leido: 'Bloque 6',
  foto: { ubicacion: 'Bloque 3' }, ...e,
});
const ubicar = (e: EscrituraHoja, filas: FilaDePrueba[]) => ubicarEscrituras([e], lectura(filas), columnas());

describe('columnasDeEncabezados', () => {
  it('localiza las columnas por su encabezado', () => {
    const c = columnas();
    expect([c.campos.ubicacion, c.campos.valor, c.imagenes, c.idWeb]).toEqual([7, 9, [14, 15, 16], 18]);
  });

  it('nombra los encabezados que faltan', () => {
    expect(columnasDeEncabezados(ENCABEZADOS_HOJA.filter((e) => e !== 'ID WEB'))).toEqual({ faltantes: ['ID WEB'] });
  });
});

describe('lecturaDesdeRango', () => {
  it('indexa las filas por ID WEB y sabe cuál es la última con datos', () => {
    const l = lectura([{ TITULO: 'A', 'ID WEB': 14 }, { TITULO: 'B', 'ID WEB': 15 }, {}]);
    expect([l.filaDeId.get(14), l.filaDeId.get(15), l.ultimaFila]).toEqual([[2], [3], 3]);
  });

  it('lee el origen de la dirección que devuelve Graph', () => {
    expect(origenDeDireccion("'Inventario Obras'!A1:R527")).toEqual({ fila: 1, columna: 1 });
    expect(origenDeDireccion('Hoja!C3:D9')).toEqual({ fila: 3, columna: 3 });
  });
});

describe('ubicarEscrituras', () => {
  it('escribe en la fila donde está ahora el ID WEB, aunque la hoja se haya reordenado', () => {
    const r = ubicar(escritura(), [{ 'ID WEB': 15 }, { 'ID WEB': 14, 'UBICACIÓN': 'Bloque 6' }]);
    expect(r.ubicadas.map((u) => [u.fila, u.columna])).toEqual([[3, 7]]);
    expect(r.descartadas).toEqual([]);
  });

  it('descarta la escritura si alguien cambió la celda desde el diff', () => {
    const r = ubicar(escritura(), [{ 'ID WEB': 14, 'UBICACIÓN': 'Bloque 8' }]);
    expect(r.descartadas.map((d) => d.motivo)).toEqual([MOTIVO_CELDA_CAMBIADA]);
  });

  it('compara normalizado: espacios y separadores de miles no cuentan como cambio', () => {
    expect(ubicar(escritura(), [{ 'ID WEB': 14, 'UBICACIÓN': ' Bloque  6' }]).ubicadas.length).toBe(1);
    const valor = escritura({ destino: { tipo: 'campo', campo: 'valor' }, valor: 1500000, leido: 1200000 });
    expect(ubicar(valor, [{ 'ID WEB': 14, VALOR: '$1.200.000' }]).ubicadas.length).toBe(1);
  });

  it('descarta si la fila desapareció o su ID WEB está repetido', () => {
    expect(ubicar(escritura(), [{ 'ID WEB': 15 }]).descartadas.map((d) => d.motivo)).toEqual([MOTIVO_SIN_FILA]);
    expect(ubicar(escritura(), [{ 'ID WEB': 14 }, { 'ID WEB': 14 }]).descartadas.map((d) => d.motivo)).toEqual([MOTIVO_ID_REPETIDO]);
  });

  it('una casilla vacía tiene que seguir vacía; una imagen pegada (#VALUE!) no se toma por vacía', () => {
    const imagen = escritura({ destino: { tipo: 'imagen', casilla: 1 }, valor: `=IMAGE("${PREFIJO}a.jpg")`, leido: { tipo: 'vacia' } });
    expect(ubicar(imagen, [{ 'ID WEB': 14, 'IMAGEN 1': '' }]).ubicadas.length).toBe(1);
    expect(ubicar(imagen, [{ 'ID WEB': 14, 'IMAGEN 1': '#VALUE!' }]).descartadas.length).toBe(1);
  });

  it('reconoce la fórmula =IMAGE que escribió la sincronización', () => {
    const url = `${PREFIJO}a.jpg`;
    const imagen = escritura({ destino: { tipo: 'imagen', casilla: 1 }, valor: '', leido: { tipo: 'formula', url } });
    expect(ubicar(imagen, [{ 'ID WEB': 14, 'IMAGEN 1': { formula: `=IMAGE("${url}")` } }]).ubicadas.length).toBe(1);
  });
});

describe('ubicarIdsNuevos', () => {
  const creada = { fila: 2, obraId: 700, campos: filaHoja(2, { autor: 'Ana', titulo: 'Nueva' }).campos, heredados: [], noConvertibles: [] };

  it('escribe el ID de una obra creada desde la hoja si su fila sigue siendo la misma', () => {
    const r = ubicarIdsNuevos([creada], lectura([{ AUTOR: 'Ana', TITULO: 'Nueva' }]), columnas());
    expect(r.ubicadas.map((u) => [u.fila, u.columna, u.escritura.valor])).toEqual([[2, 18, 700]]);
  });

  it('no escribe si la fila ya no es la misma o ya tiene un ID', () => {
    expect(ubicarIdsNuevos([creada], lectura([{ AUTOR: 'Ana', TITULO: 'Otra' }]), columnas()).descartadas.length).toBe(1);
    expect(ubicarIdsNuevos([creada], lectura([{ AUTOR: 'Ana', TITULO: 'Nueva', 'ID WEB': 5 }]), columnas()).descartadas.length).toBe(1);
  });

  it('escribe el ID aunque el AUTOR de la fila sea una celda combinada que Graph devuelve vacía', () => {
    const enBloque = { ...creada, heredados: ['autor' as const] };
    const r = ubicarIdsNuevos([enBloque], lectura([{ AUTOR: '', TITULO: 'Nueva' }]), columnas());
    expect(r.ubicadas.length).toBe(1);
  });

  it('no confunde dos obras sin autor ni título que difieren en otro campo', () => {
    const anonima = { fila: 2, obraId: 701, campos: filaHoja(2, { tecnica: 'Óleo' }).campos, heredados: [], noConvertibles: [] };
    const r = ubicarIdsNuevos([anonima], lectura([{ TECNICA: 'Acuarela' }]), columnas());
    expect(r.ubicadas).toEqual([]);
    expect(r.descartadas.length).toBe(1);
  });
});

describe('agruparEnBloques', () => {
  it('agrupa en un solo rango las filas contiguas de una misma columna', () => {
    const u = (fila: number, columna: number) => ({ escritura: escritura({ valor: `v${fila}` }), fila, columna });
    const bloques = agruparEnBloques([u(2, 7), u(3, 7), u(5, 7), u(2, 13)]);
    expect(bloques.map((b) => [b.direccion, b.valores])).toEqual([
      ['G2:G3', [['v2'], ['v3']]],
      ['G5:G5', [['v5']]],
      ['M2:M2', [['v2']]],
    ]);
  });
});

describe('bloqueDeAltas', () => {
  it('añade las altas al final sin tocar las columnas que no son de la sincronización', () => {
    const bloque = bloqueDeAltas(
      [{ obraId: 30, celdas: [{ destino: { tipo: 'campo', campo: 'titulo' }, valor: 'Nueva' }], foto: {} }],
      528,
      columnas()
    );
    expect(bloque?.direccion).toBe('A528:R528');
    expect([bloque?.valores[0][0], bloque?.valores[0][2], bloque?.valores[0][17]]).toEqual([null, 'Nueva', 30]);
  });

  it('sin altas no hay bloque', () => {
    expect(bloqueDeAltas([], 528, columnas())).toBeNull();
  });
});
