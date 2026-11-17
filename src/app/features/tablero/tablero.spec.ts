import { calcularTablero, familiaTecnica, numeroDeBloque, ObraTablero } from './tablero';

const obra = (id: number, o: Partial<ObraTablero> = {}): ObraTablero => ({
  id, titulo: `Obra ${id}`, autor: 'Ana', tecnica: 'Óleo', ubicacion: 'Bloque 6', bloque: 'BLOQUE 6', responsable: 'JOBANY',
  fechaCreacion: '2026-09-01T12:00:00Z', imagenes: 1, ano: null, valor: null, ...o,
});
const HOY = new Date(2026, 9, 11, 10, 42);

describe('calcularTablero', () => {
  it('cuenta el total y las obras creadas este mes', () => {
    const r = calcularTablero([obra(1), obra(2, { fechaCreacion: '2026-10-10T15:00:00Z' }), obra(3, { fechaCreacion: null })], HOY);
    expect([r.total, r.nuevasEsteMes]).toEqual([3, 1]);
  });

  it('una ficha incompleta es la que no tiene autor, técnica, bloque, responsable o imagen, y se cuenta una vez', () => {
    const r = calcularTablero(
      [obra(1), obra(2, { autor: null, imagenes: 0 }), obra(3, { tecnica: '  ' }), obra(4, { responsable: null }), obra(5, { bloque: null })],
      HOY
    );
    expect([r.incompletas, r.porcentajeIncompletas, r.sinImagen, r.sinBloque]).toEqual([4, 80, 1, 1]);
    expect(r.pendientes.bloque.map((o) => o.id)).toEqual([5]);
    expect(r.pendientes.autor.map((o) => o.id)).toEqual([2]);
    expect(r.pendientes.tecnica.map((o) => o.id)).toEqual([3]);
    expect(r.pendientes.responsable.map((o) => o.id)).toEqual([4]);
    expect(r.pendientes.imagen.map((o) => o.id)).toEqual([2]);
  });

  it('agrupa por bloque, de más a menos obras, con el nombre del edificio cuando lo tiene', () => {
    const r = calcularTablero(
      [
        obra(1, { bloque: 'BLOQUE 15' }), obra(2, { bloque: 'BLOQUE 15' }), obra(3, { bloque: 'BLOQUE 3' }),
        obra(4, { bloque: 'BLOQUE 6' }), obra(5, { bloque: 'BLOOQUE 3' }), obra(6, { bloque: 'BLOQUE 15' }),
      ],
      HOY
    );
    expect(r.porBloque.map((b) => [b.numero, b.nombre, b.obras, b.proporcion])).toEqual([
      [15, 'Biblioteca Central', 3, 1],
      [3, 'Bloque Rectoral', 2, 2 / 3],
      [6, null, 1, 1 / 3],
    ]);
  });

  it('dentro de cada bloque agrupa los lugares sin distinguir mayúsculas, con la grafía más usada y las obras sin ubicación al final', () => {
    const r = calcularTablero(
      [
        obra(1, { ubicacion: 'Biblioteca Central (Depósito)' }), obra(2, { ubicacion: 'biblioteca central  (Depósito)' }),
        obra(3, { ubicacion: 'Biblioteca Central (Depósito)' }), obra(4, { ubicacion: 'Sala Betancur' }), obra(5, { ubicacion: null }),
      ].map((o) => ({ ...o, bloque: 'BLOQUE 15' })),
      HOY,
    );
    expect(r.porBloque[0].lugares.map((l) => [l.nombre, l.obras, l.proporcion, l.fichas.map((o) => o.id)])).toEqual([
      ['Biblioteca Central (Depósito)', 3, 3 / 5, [1, 2, 3]],
      ['Sala Betancur', 1, 1 / 5, [4]],
      [null, 1, 1 / 5, [5]],
    ]);
  });

  it('muestra todos los lugares de un bloque', () => {
    const obras = Array.from({ length: 9 }, (_, i) => obra(i + 1, { ubicacion: `Piso ${i + 1}` }));
    expect(calcularTablero(obras, HOY).porBloque[0].lugares.length).toBe(9);
  });

  it('dentro de un lugar ordena las obras por título y deja al final las que no tienen', () => {
    const obras = [obra(1, { titulo: null }), obra(2, { titulo: 'Zócalo' }), obra(3, { titulo: 'Árbol' }), obra(4, { titulo: 'Árbol 10' }), obra(5, { titulo: 'Árbol 2' })].map((o) => ({ ...o, ubicacion: 'Piso 1' }));
    expect(calcularTablero(obras, HOY).porBloque[0].lugares[0].fichas.map((o) => o.id)).toEqual([3, 5, 4, 2, 1]);
  });

  it('agrupa las técnicas por su primera palabra, sin tildes ni plural, y descarta lo que no es una técnica', () => {
    expect(['Óleo sobre tela', 'OLEO SOBRE LIENSO', 'Esculturas', 'Impresión fotográfica', 'Mixta sobre madera', 'No tiene', '1993', '  '].map((t) => familiaTecnica(t)?.[0] ?? null))
      .toEqual(['oleo', 'oleo', 'escultura', 'fotografia', 'mixta', null, null, null]);
    expect(familiaTecnica('Mixta')?.[1]).toBe('Técnica mixta');
  });

  it('resume la colección: técnicas y artistas más frecuentes, y las obras por época', () => {
    const obras = [
      obra(1, { tecnica: 'Óleo sobre tela', autor: 'Pedro Nel Gómez', ano: 1955 }),
      obra(2, { tecnica: 'Oleo', autor: 'pedro nel gomez', ano: 1987 }),
      obra(3, { tecnica: 'Acuarela', autor: 'Fabio Mesa', ano: 1993 }),
      obra(4, { tecnica: 'Escultura', autor: null, ano: 2004 }),
      obra(5, { tecnica: null, autor: 'Fabio Mesa', ano: 2011 }),
      obra(6, { ano: 2022 }), obra(7, { ano: 2023 }), obra(8, { ano: null }),
    ];
    const { coleccion } = calcularTablero(obras, HOY);
    expect(coleccion.tecnicas.primeros.map((c) => [c.nombre, c.obras])).toEqual([['Óleo', 5], ['Acuarela', 1], ['Escultura', 1]]);
    expect(coleccion.autores.primeros.map((c) => [c.nombre, c.obras, c.proporcion])).toEqual([['Ana', 3, 1], ['Fabio Mesa', 2, 2 / 3], ['Pedro Nel Gómez', 2, 2 / 3]]);
    expect(coleccion.epocas.map((e) => [e.nombre, e.obras])).toEqual([['Antes de 1980', 1], ['1980', 1], ['1990', 1], ['2000', 1], ['2010', 1], ['2020', 2]]);
    expect(coleccion.conAno).toBe(7);
  });

  it('muestra seis técnicas y cuenta cuántas quedan fuera', () => {
    const obras = ['Óleo', 'Acuarela', 'Escultura', 'Grabado', 'Mural', 'Pastel', 'Dibujo', 'Bronce'].map((tecnica, i) => obra(i + 1, { tecnica }));
    const { tecnicas } = calcularTablero(obras, HOY).coleccion;
    expect([tecnicas.primeros.length, tecnicas.resto, tecnicas.conDato]).toEqual([6, 2, 8]);
  });

  it('suma el valor estimado y cuenta las obras sin avalúo', () => {
    const r = calcularTablero([obra(1, { valor: 2_500_000 }), obra(2, { valor: 1_000_000 }), obra(3, { valor: null }), obra(4, { valor: 0 })], HOY);
    expect([r.valorTotal, r.sinValor]).toEqual([3_500_000, 2]);
  });

  it('con el inventario vacío no divide por cero', () => {
    const r = calcularTablero([], HOY);
    expect([r.total, r.incompletas, r.porcentajeIncompletas, r.sinBloque, r.porBloque.length]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('numeroDeBloque', () => {
  it('lee el número aunque la hoja tenga erratas o abreviaturas', () => {
    expect(['BLOQUE 15', 'Bloque 3', 'BLOOQUE 3', 'BL 12', ' bloque  6 '].map(numeroDeBloque)).toEqual([15, 3, 3, 12, 6]);
  });

  it('sin número no hay bloque', () => {
    expect([null, '', '   ', 'Biblioteca', 'BLOQUE'].map(numeroDeBloque)).toEqual([null, null, null, null, null]);
  });
});
