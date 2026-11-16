import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TarjetaObraComponent } from './tarjeta-obra.component';
import { Artwork } from '../../../../../shared/models/artwork.model';
import { obraDePrueba } from '../obra-de-prueba';

function montar(obra: Artwork, esAdmin: boolean, modo: 'galeria' | 'mosaico' = 'galeria') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [TarjetaObraComponent], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(TarjetaObraComponent);
  fixture.componentRef.setInput('obra', obra);
  fixture.componentRef.setInput('esAdmin', esAdmin);
  fixture.componentRef.setInput('modo', modo);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TarjetaObraComponent', () => {
  it('muestra título, autor y enlaza a la ficha', () => {
    const html = montar(obraDePrueba(), false);
    expect(html.textContent).toContain('Paisaje');
    expect(html.textContent).toContain('Ana Pérez');
    expect(html.querySelector('a')?.getAttribute('href')).toBe('/obra/14');
  });

  it('sin rol de administrador no muestra la ubicación', () => {
    expect(montar(obraDePrueba(), false).textContent).not.toContain('Bloque 6');
    expect(montar(obraDePrueba(), true).textContent).toContain('Bloque 6');
  });

  it('la ubicación lleva un icono decorativo delante', () => {
    const fila = [...montar(obraDePrueba(), true).querySelectorAll('p')].find((p) => p.textContent?.includes('Bloque 6'))!;
    const icono = fila.firstElementChild!;
    expect(icono.tagName.toLowerCase()).toBe('svg');
    expect(icono.getAttribute('aria-hidden')).toBe('true');
  });

  it('el autor lleva un icono decorativo delante', () => {
    const fila = [...montar(obraDePrueba(), false).querySelectorAll('p')].find((p) => p.textContent?.includes('Ana Pérez'))!;
    const icono = fila.firstElementChild!;
    expect(icono.tagName.toLowerCase()).toBe('svg');
    expect(icono.getAttribute('aria-hidden')).toBe('true');
  });

  it('una obra sin título ni autor no queda vacía', () => {
    const html = montar(obraDePrueba({ titulo: null, autor: '  ' }), false);
    expect(html.textContent).toContain('Sin título');
    expect(html.textContent).toContain('No registra');
  });

  it('en mosaico muestra la imagen con título y autor encima', () => {
    const html = montar(obraDePrueba({ imagenes: [{ id: 1, url: 'https://x/a.jpg', nombre: 'a.jpg' }] }), true, 'mosaico');
    expect(html.querySelector('img')?.getAttribute('src')).toBe('https://x/a.jpg');
    expect(html.textContent).toContain('Paisaje');
    expect(html.textContent).not.toContain('Bloque 6');
  });
});
