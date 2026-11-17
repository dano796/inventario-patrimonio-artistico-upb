import { CLAVE_VISTA, chipsFiltros, guardarVista, leerVista, lineaResultado, ValoresFiltros } from './galeria';

const vacios = (v: Partial<ValoresFiltros> = {}): ValoresFiltros => ({
  busqueda: '', ubicacion: '', ubicaciones: [], responsable: '', autor: '', tecnica: '', falta: '', ...v,
});

describe('chipsFiltros', () => {
  it('crea un chip por filtro con valor, en el orden del panel', () => {
    const chips = chipsFiltros(vacios({ busqueda: ' Paisaje ', autor: 'Londoño', tecnica: 'Óleo' }), false);
    expect(chips).toEqual([
      { clave: 'busqueda', valor: 'Paisaje', texto: 'Título: Paisaje' },
      { clave: 'autor', valor: 'Londoño', texto: 'Autor: Londoño' },
      { clave: 'tecnica', valor: 'Óleo', texto: 'Técnica: Óleo' },
    ]);
  });

  it('sin rol de administrador nunca muestra ubicación ni responsable', () => {
    const chips = chipsFiltros(vacios({ ubicacion: 'Bloque 6', ubicaciones: ['Bloque 3'], responsable: 'Ana' }), false);
    expect(chips).toEqual([]);
  });

  it('un administrador ve un chip por cada ubicación añadida, o la escrita si no hay ninguna', () => {
    expect(chipsFiltros(vacios({ ubicacion: 'Bloque', ubicaciones: ['Bloque 3', 'Bloque 6'] }), true).map((c) => c.texto)).toEqual([
      'Ubicación: Bloque 3',
      'Ubicación: Bloque 6',
    ]);
    expect(chipsFiltros(vacios({ ubicacion: 'Bloque 6', responsable: 'Ana' }), true).map((c) => c.texto)).toEqual([
      'Ubicación: Bloque 6',
      'Responsable: Ana',
    ]);
  });

  it('ignora los filtros que solo tienen espacios', () => {
    expect(chipsFiltros(vacios({ autor: '   ' }), true)).toEqual([]);
  });
});

describe('filtro por dato faltante', () => {
  it('es un chip propio, solo para administradores', () => {
    expect(chipsFiltros(vacios({ falta: 'autor' }), true)).toEqual([{ clave: 'falta', valor: 'autor', texto: 'Sin autor registrado' }]);
    expect(chipsFiltros(vacios({ falta: 'autor' }), false)).toEqual([]);
  });

  it('la línea de resultado lo dice con palabras', () => {
    const chips = chipsFiltros(vacios({ falta: 'imagen' }), true);
    expect(lineaResultado(74, chips)).toBe('Mostrando 74 obras sin imagen');
    expect(lineaResultado(3, chipsFiltros(vacios({ falta: 'imagen', autor: 'Toro' }), true))).toBe('Mostrando 3 obras sin imagen, filtradas por autor');
  });
});

describe('lineaResultado', () => {
  it('sin filtros solo cuenta', () => {
    expect(lineaResultado(187, [])).toBe('Mostrando 187 obras');
    expect(lineaResultado(1, [])).toBe('Mostrando 1 obra');
  });

  it('nombra los criterios una vez cada uno', () => {
    const chips = chipsFiltros(vacios({ autor: 'Ana', ubicaciones: ['Bloque 3', 'Bloque 6'], tecnica: 'Óleo' }), true);
    expect(lineaResultado(12, chips)).toBe('Mostrando 12 obras filtradas por ubicación, autor y técnica');
    expect(lineaResultado(1, chips.slice(-1))).toBe('Mostrando 1 obra filtrada por técnica');
  });

  it('sin resultados lo dice', () => {
    expect(lineaResultado(0, chipsFiltros(vacios({ autor: 'Nadie' }), false))).toBe('Ninguna obra coincide con los filtros');
    expect(lineaResultado(0, [])).toBe('Todavía no hay obras');
  });
});

describe('vista', () => {
  afterEach(() => localStorage.removeItem(CLAVE_VISTA));

  it('por defecto es la galería y recuerda la elegida', () => {
    expect(leerVista()).toBe('galeria');
    guardarVista('tabla');
    expect(leerVista()).toBe('tabla');
  });

  it('ignora un valor guardado que no es una vista', () => {
    localStorage.setItem(CLAVE_VISTA, 'lista');
    expect(leerVista()).toBe('galeria');
  });

  it('con el almacenamiento bloqueado vuelve a la galería sin lanzar', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('bloqueado');
    expect(leerVista()).toBe('galeria');
  });
});
