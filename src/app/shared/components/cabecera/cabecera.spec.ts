import { etiquetaRol, iniciales } from './cabecera';

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras, en mayúscula', () => {
    expect(iniciales('Jobany Alonso Tobón')).toBe('JA');
    expect(iniciales('  lina   cardona ')).toBe('LC');
  });

  it('con una sola palabra usa una letra, y sin nombre un signo neutro', () => {
    expect(iniciales('Lina')).toBe('L');
    expect(iniciales(null)).toBe('?');
    expect(iniciales('   ')).toBe('?');
  });
});

describe('etiquetaRol', () => {
  it('distingue administración de consulta', () => {
    expect(etiquetaRol(true)).toBe('Administrador');
    expect(etiquetaRol(false)).toBe('Consulta');
  });
});
