import { descomprimirXlsx, leerHoja } from './leer-xlsx';
import { ErrorEncabezados, leerFilasObras } from './hoja-obras';
import { CeldaDePrueba, crearXlsxDePrueba } from './pruebas/xlsx-de-prueba';
import { MOTIVO_OTRA_MONEDA } from './normalizacion';

const ENCABEZADOS_HOJA: [string, string][] = [
  ['A', 'NÚMERO DE INVENTARIO'], ['B', 'AUTOR'], ['C', 'TITULO'], ['D', 'TECNICA'],
  ['E', 'DIMENSION (cm)'], ['F', 'FECHA ELABORACIÓN'], ['G', 'UBICACIÓN'], ['H', 'BLOQUE ASIGNADO'],
  ['I', 'VALOR'], ['J', 'DESCRIPCION'], ['K', 'RESPONSABLE'], ['L', 'CARGO'],
  ['M', 'OBSERVACIONES'], ['N', 'IMAGEN 1'], ['O', 'IMAGEN 2'], ['P', 'IMAGEN 3'],
  ['Q', 'OBSERVACION JEFFERSON 26 DE MARZO 2026'],
];

function filas(celdas: CeldaDePrueba[], opciones: { encabezados?: [string, string][]; combinadas?: string[] } = {}) {
  const encabezados = (opciones.encabezados ?? ENCABEZADOS_HOJA).map(([col, texto]) => ({ ref: `${col}1`, texto }));
  const datos = crearXlsxDePrueba({ celdas: [...encabezados, ...celdas], combinadas: opciones.combinadas });
  return leerFilasObras(leerHoja(descomprimirXlsx(datos), 'Inventario Obras', new DOMParser()));
}

describe('leerFilasObras', () => {
  it('lee una fila completa y convierte sus valores', () => {
    const r = filas([
      { ref: 'A2', formula: 'ROW(A1)', valorFormula: 1 },
      { ref: 'B2', texto: 'Alex Eugenio Kuilvietis' },
      { ref: 'C2', texto: 'Cruz Típica de Lituania' },
      { ref: 'F2', numero: 2002 },
      { ref: 'I2', texto: 'No registra' },
      { ref: 'K2', texto: 'JORGE IVÁN ÁLVAREZ GÓMEZ ' },
      { ref: 'L2', texto: 'COORDINADOR TEMPLO' },
      { ref: 'N2', imagen: 'image1.jpeg' },
    ]);
    expect(r.filas.length).toBe(1);
    const fila = r.filas[0];
    expect(fila.fila).toBe(2);
    expect(fila.idWeb).toBeNull();
    expect(fila.campos.autor).toBe('Alex Eugenio Kuilvietis');
    expect(fila.campos.ano).toBe(2002);
    expect(fila.campos.valor).toBeNull();
    expect(fila.campos.responsable).toBe('JORGE IVÁN ÁLVAREZ GÓMEZ');
    expect(fila.campos.descripcion).toBeNull();
    expect(fila.noConvertibles).toEqual([]);
    expect(fila.imagenes).toEqual([
      { tipo: 'pegada', archivo: 'xl/media/image1.jpeg' },
      { tipo: 'vacia' },
      { tipo: 'vacia' },
    ]);
    expect(r.avisos).toEqual([]);
  });

  it('encuentra los encabezados por su nombre aunque cambien tildes, espacios u orden', () => {
    const encabezados = ENCABEZADOS_HOJA.map(([col, texto]): [string, string] =>
      col === 'C' ? ['D', 'TÍTULO '] : col === 'D' ? ['C', 'Técnica'] : [col, texto]
    );
    const r = filas(
      [{ ref: 'B2', texto: 'Autor' }, { ref: 'C2', texto: 'Óleo' }, { ref: 'D2', texto: 'Paisaje' }],
      { encabezados }
    );
    expect(r.filas[0].campos.titulo).toBe('Paisaje');
    expect(r.filas[0].campos.tecnica).toBe('Óleo');
  });

  it('aborta nombrando los encabezados que faltan', () => {
    const encabezados = ENCABEZADOS_HOJA.filter(([col]) => col !== 'I' && col !== 'O');
    expect(() => filas([], { encabezados })).toThrowMatching(
      (e) => e instanceof ErrorEncabezados && e.faltantes.join() === 'VALOR,IMAGEN 2'
    );
  });

  it('aborta si un encabezado que usa la sincronización está repetido', () => {
    expect(() => filas([], { encabezados: [...ENCABEZADOS_HOJA, ['R', 'OBSERVACIONES']] })).toThrowError(
      ErrorEncabezados,
      /OBSERVACIONES/
    );
  });

  it('no aborta si lo repetido es una columna que la sincronización no usa', () => {
    expect(() => filas([], { encabezados: [...ENCABEZADOS_HOJA, ['R', 'NÚMERO DE INVENTARIO']] })).not.toThrow();
  });

  it('marca como no convertibles los valores que no caben en la base', () => {
    const r = filas([
      { ref: 'C2', texto: 'Obra' },
      { ref: 'F2', texto: '1950-1955' },
      { ref: 'I2', texto: 'USD 5,000' },
    ]);
    expect(r.filas[0].campos.ano).toBeNull();
    expect(r.filas[0].campos.valor).toBeNull();
    expect(r.filas[0].noConvertibles).toEqual(['ano', 'valor']);
    expect(r.avisos).toContain({ fila: 2, campo: 'valor', motivo: MOTIVO_OTRA_MONEDA, original: 'USD 5,000' });
    expect(r.avisos.find((a) => a.campo === 'ano')?.original).toBe('1950-1955');
  });

  it('aplica el valor de una celda combinada a todas sus filas y las marca', () => {
    const r = filas(
      [
        { ref: 'C3', texto: 'Uno' }, { ref: 'C4', texto: 'Dos' }, { ref: 'C5', texto: 'Tres' },
        { ref: 'I3', numero: 800000 },
      ],
      { combinadas: ['I3:I5'] }
    );
    expect(r.filas.map((f) => f.campos.valor)).toEqual([800000, 800000, 800000]);
    expect(r.filas.every((f) => f.combinados.includes('valor'))).toBeTrue();
    expect(r.filas.every((f) => !f.combinados.includes('titulo'))).toBeTrue();
    expect(r.filas.map((f) => f.heredados.includes('valor'))).toEqual([false, true, true]);
  });

  it('clasifica el contenido de las columnas de imagen', () => {
    const r = filas([
      { ref: 'C2', texto: 'Obra' },
      { ref: 'N2', texto: 'Ubicación no corresponde' },
      { ref: 'O2', formula: '_xlfn.IMAGE("https://b.test/x.jpg")', valorFormula: '#VALUE!' },
    ]);
    expect(r.filas[0].imagenes).toEqual([
      { tipo: 'texto', valor: 'Ubicación no corresponde' },
      { tipo: 'formula', url: 'https://b.test/x.jpg' },
      { tipo: 'vacia' },
    ]);
  });

  it('lee el ID WEB y avisa de los que no son válidos', () => {
    const r = filas(
      [
        { ref: 'C2', texto: 'Uno' }, { ref: 'R2', numero: 14 },
        { ref: 'C3', texto: 'Dos' }, { ref: 'R3', texto: 'abc' },
      ],
      { encabezados: [...ENCABEZADOS_HOJA, ['R', 'ID WEB']] }
    );
    expect(r.columnaIdWeb).toBe(18);
    expect(r.filas.map((f) => f.idWeb)).toEqual([14, null]);
    expect(r.avisos).toContain({ fila: 3, campo: 'id_web', motivo: 'el ID WEB no es un número entero positivo', original: 'abc' });
  });

  it('avisa de un error de Excel en IMAGEN o en ID WEB en vez de tratarlo como vacío', () => {
    const r = filas(
      [
        { ref: 'C2', texto: 'Uno' },
        { ref: 'O2', error: '#REF!' },
        { ref: 'R2', formula: 'A1/0', valorFormula: '#DIV/0!' },
      ],
      { encabezados: [...ENCABEZADOS_HOJA, ['R', 'ID WEB']] }
    );
    expect(r.filas[0].imagenes[1]).toEqual({ tipo: 'vacia' });
    expect(r.filas[0].idWeb).toBeNull();
    expect(r.avisos).toContain({ fila: 2, campo: 'imagen_2', motivo: 'la celda tiene un error de Excel', original: '#REF!' });
    expect(r.avisos).toContain({ fila: 2, campo: 'id_web', motivo: 'la celda tiene un error de Excel', original: '#DIV/0!' });
  });

  it('ignora las filas que solo tienen el número de fila de Excel', () => {
    const r = filas([
      { ref: 'C2', texto: 'Uno' },
      { ref: 'A3', formula: 'ROW(A2)', valorFormula: 2 },
    ]);
    expect(r.filas.map((f) => f.fila)).toEqual([2]);
  });

  it('avisa de una imagen pegada en una columna de datos', () => {
    const r = filas([{ ref: 'B2', imagen: 'image1.jpeg' }, { ref: 'C2', texto: 'Obra' }]);
    expect(r.filas[0].campos.autor).toBeNull();
    expect(r.filas[0].noConvertibles).toEqual(['autor']);
    expect(r.avisos[0].motivo).toBe('la celda contiene una imagen');
  });
});
