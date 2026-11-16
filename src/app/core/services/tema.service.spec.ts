import { TestBed } from '@angular/core/testing';
import { CLAVE_TEMA, TemaService } from './tema.service';

describe('TemaService', () => {
  const crear = () => TestBed.inject(TemaService);
  const preferirOscuro = (oscuro: boolean) =>
    spyOn(window, 'matchMedia').and.returnValue({ matches: oscuro } as MediaQueryList);

  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => {
    localStorage.removeItem(CLAVE_TEMA);
    document.documentElement.removeAttribute('data-theme');
  });

  it('sin elección guardada sigue la preferencia del sistema y la aplica a <html>', () => {
    preferirOscuro(true);
    const tema = crear();
    expect(tema.tema()).toBe('oscuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');
  });

  it('una elección guardada manda sobre la preferencia del sistema', () => {
    localStorage.setItem(CLAVE_TEMA, 'claro');
    preferirOscuro(true);
    expect(crear().tema()).toBe('claro');
  });

  it('alternar cambia el tema, lo aplica y lo guarda', () => {
    preferirOscuro(false);
    const tema = crear();
    tema.alternar();
    expect(tema.tema()).toBe('oscuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro');
  });

  it('establecer fija el tema elegido, lo aplica y lo guarda', () => {
    preferirOscuro(false);
    const tema = crear();
    tema.establecer('oscuro');
    tema.establecer('oscuro');
    expect(tema.tema()).toBe('oscuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro');
    tema.establecer('claro');
    expect(tema.tema()).toBe('claro');
  });

  it('funciona aunque el almacenamiento lance', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('bloqueado');
    spyOn(Storage.prototype, 'setItem').and.throwError('bloqueado');
    preferirOscuro(false);
    const tema = crear();
    tema.alternar();
    expect(tema.tema()).toBe('oscuro');
  });

  it('ignora un valor guardado que no es un tema', () => {
    localStorage.setItem(CLAVE_TEMA, 'morado');
    preferirOscuro(false);
    expect(crear().tema()).toBe('claro');
  });
});
