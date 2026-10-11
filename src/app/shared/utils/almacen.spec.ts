import { guardarAlmacen, leerAlmacen } from './almacen';

describe('almacen', () => {
  afterEach(() => localStorage.removeItem('prueba-almacen'));

  it('guarda y lee un valor', () => {
    guardarAlmacen('prueba-almacen', 'tabla');
    expect(leerAlmacen('prueba-almacen')).toBe('tabla');
  });

  it('devuelve null si el almacenamiento lanza al leer', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('bloqueado');
    expect(leerAlmacen('prueba-almacen')).toBeNull();
  });

  it('no lanza si el almacenamiento lanza al guardar', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('lleno');
    expect(() => guardarAlmacen('prueba-almacen', 'tabla')).not.toThrow();
  });
});
