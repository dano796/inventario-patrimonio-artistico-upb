import { camposFicha, mensajeBorrado, subtituloFicha, ultimaCaptura } from './ficha';
import { obraDePrueba } from '../components/galeria/obra-de-prueba';

describe('camposFicha', () => {
  it('sin rol de administrador muestra solo los campos públicos', () => {
    expect(camposFicha(obraDePrueba(), false).map((c) => c.etiqueta)).toEqual(['Técnica', 'Dimensión', 'Año', 'Descripción']);
  });

  it('un administrador ve también custodia y valor, con el valor en pesos', () => {
    const campos = camposFicha(obraDePrueba(), true);
    expect(campos.map((c) => c.etiqueta)).toEqual([
      'Técnica', 'Dimensión', 'Año', 'Descripción', 'Ubicación', 'Bloque asignado', 'Valor estimado', 'Responsable', 'Cargo',
    ]);
    expect(campos.find((c) => c.etiqueta === 'Valor estimado')?.valor).toContain('1.200.000');
  });

  it('un campo vacío o con espacios se muestra como «No registra» y se marca', () => {
    const dimension = camposFicha(obraDePrueba({ dimension: '  ' }), false).find((c) => c.etiqueta === 'Dimensión');
    expect(dimension).toEqual({ etiqueta: 'Dimensión', valor: 'No registra', vacio: true });
  });
});

describe('camposFicha con una lectura sin columnas restringidas', () => {
  it('lo que no llegó se muestra como «No registra», nunca «undefined» ni «NaN»', () => {
    const { ubicacion, bloque_asignado, valor, responsable, cargo, ...publica } = obraDePrueba();
    const textos = camposFicha(publica as never, true).map((c) => c.valor);
    expect(textos.join(' ')).not.toMatch(/undefined|NaN/);
  });
});

describe('subtituloFicha', () => {
  it('une autor y año, y nombra lo que falta', () => {
    expect(subtituloFicha(obraDePrueba())).toBe('Ana Pérez · 1998');
    expect(subtituloFicha(obraDePrueba({ autor: null, ano: null }))).toBe('Autor no registrado');
  });
});

describe('ultimaCaptura', () => {
  it('toma la fecha más reciente y cuenta las imágenes', () => {
    const imagenes = [
      { url: 'a', nombre: 'a', fecha_creacion: '2024-03-01T12:00:00Z' },
      { url: 'b', nombre: 'b', fecha_creacion: '2025-10-22T12:00:00Z' },
    ];
    expect(ultimaCaptura(imagenes)).toBe('Última captura 22/10/2025 · 2 imágenes');
  });

  it('sin fechas no dice nada', () => {
    expect(ultimaCaptura([])).toBeNull();
    expect(ultimaCaptura([{ url: 'a', nombre: 'a' }])).toBeNull();
  });
});

describe('mensajeBorrado', () => {
  it('nombra la obra y sus imágenes', () => {
    expect(mensajeBorrado('Paisaje', 3)).toBe('«Paisaje» y sus 3 imágenes se eliminarán de forma permanente.');
    expect(mensajeBorrado('Paisaje', 1)).toBe('«Paisaje» y su imagen se eliminarán de forma permanente.');
    expect(mensajeBorrado('Paisaje', 0)).toBe('«Paisaje» se eliminará de forma permanente.');
  });
});
