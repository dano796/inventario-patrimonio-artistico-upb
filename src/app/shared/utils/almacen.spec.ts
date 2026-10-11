import { borrarAlmacen, guardarAlmacen, leerAlmacen } from './almacen';

describe('almacen', () => {
  afterEach(() => borrarAlmacen('prueba-almacen'));

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

  it('borra un valor guardado', () => {
    guardarAlmacen('prueba-almacen', 'tabla');
    borrarAlmacen('prueba-almacen');
    expect(leerAlmacen('prueba-almacen')).toBeNull();
  });

  it('no lanza si el almacenamiento lanza al borrar', () => {
    spyOn(Storage.prototype, 'removeItem').and.throwError('bloqueado');
    expect(() => borrarAlmacen('prueba-almacen')).not.toThrow();
  });
});
