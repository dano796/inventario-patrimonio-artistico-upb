import { borrarAlmacen, borrarSesion, guardarAlmacen, guardarSesion, leerAlmacen, leerSesion } from './almacen';

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

describe('almacen de sesión', () => {
  afterEach(() => borrarSesion('prueba-sesion'));

  it('guarda en sessionStorage, no en localStorage', () => {
    guardarSesion('prueba-sesion', 'borrador');
    expect(leerSesion('prueba-sesion')).toBe('borrador');
    expect(sessionStorage.getItem('prueba-sesion')).toBe('borrador');
    expect(localStorage.getItem('prueba-sesion')).toBeNull();
  });

  it('borra un valor guardado', () => {
    guardarSesion('prueba-sesion', 'borrador');
    borrarSesion('prueba-sesion');
    expect(leerSesion('prueba-sesion')).toBeNull();
  });

  it('no lanza si el almacenamiento está bloqueado', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('bloqueado');
    spyOn(Storage.prototype, 'setItem').and.throwError('lleno');
    spyOn(Storage.prototype, 'removeItem').and.throwError('bloqueado');
    expect(leerSesion('prueba-sesion')).toBeNull();
    expect(() => guardarSesion('prueba-sesion', 'x')).not.toThrow();
    expect(() => borrarSesion('prueba-sesion')).not.toThrow();
  });
});
