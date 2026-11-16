import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TablaObrasComponent } from './tabla-obras.component';
import { obraDePrueba } from '../obra-de-prueba';

function montar(esAdmin: boolean) {
  TestBed.configureTestingModule({ imports: [TablaObrasComponent], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(TablaObrasComponent);
  fixture.componentRef.setInput('obras', [obraDePrueba(), obraDePrueba({ id: 15, titulo: null, tecnica: null, ano: null })]);
  fixture.componentRef.setInput('esAdmin', esAdmin);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TablaObrasComponent', () => {
  it('sin rol de administrador no tiene ninguna columna restringida', () => {
    const html = montar(false);
    for (const restringida of ['Ubicación', 'Bloque', 'Valor', 'Responsable']) expect(html.querySelector('thead')?.textContent).not.toContain(restringida);
    expect(html.textContent).not.toContain('Bloque 6');
  });

  it('un administrador ve la ubicación', () => {
    const html = montar(true);
    expect(html.querySelector('thead')?.textContent).toContain('Ubicación');
    expect(html.textContent).toContain('Bloque 6');
  });

  it('las columnas siguen el orden de la hoja oficial', () => {
    const cabeceras = (html: HTMLElement) => [...html.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(cabeceras(montar(true))).toEqual(['Autor', 'Título', 'Técnica', 'Dimensión', 'Año', 'Ubicación', 'Bloque', 'Responsable', 'Imagen']);
    TestBed.resetTestingModule();
    expect(cabeceras(montar(false))).toEqual(['Autor', 'Título', 'Técnica', 'Dimensión', 'Año', 'Imagen']);
  });

  it('la última columna muestra la primera imagen o el marcador «Sin imagen»', () => {
    TestBed.configureTestingModule({ imports: [TablaObrasComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TablaObrasComponent);
    const imagen = { id: 1, id_obra: 14, url: 'https://ejemplo.test/a.jpg', nombre: 'a.jpg' } as never;
    fixture.componentRef.setInput('obras', [obraDePrueba({ imagenes: [imagen] }), obraDePrueba({ id: 15, imagenes: [] })]);
    fixture.detectChanges();
    const filas = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(filas[0].querySelector('img')?.getAttribute('src')).toBe('https://ejemplo.test/a.jpg');
    expect(filas[1].querySelector('[aria-label="Sin imagen"]')).not.toBeNull();
  });

  it('el clic en una fila abre la ficha y el clic en la miniatura amplía la imagen sin navegar', () => {
    TestBed.configureTestingModule({ imports: [TablaObrasComponent], providers: [provideRouter([])] });
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(TablaObrasComponent);
    const imagen = { id: 1, id_obra: 14, url: 'https://ejemplo.test/a.jpg', nombre: 'a.jpg' } as never;
    fixture.componentRef.setInput('obras', [obraDePrueba({ imagenes: [imagen] })]);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    html.querySelector<HTMLElement>('tbody td')!.click();
    expect(navegar).toHaveBeenCalledOnceWith(['/obra', 14]);

    html.querySelector<HTMLButtonElement>('button[aria-label^="Ampliar"]')!.click();
    fixture.detectChanges();
    expect(navegar).toHaveBeenCalledTimes(1);
    expect(html.querySelector('[role="dialog"] img')?.getAttribute('src')).toBe('https://ejemplo.test/a.jpg');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(html.querySelector('[role="dialog"]')).toBeNull();
  });

  it('una fila sin datos muestra «Sin título» y «No registra» y enlaza a la ficha', () => {
    const fila = montar(false).querySelectorAll('tbody tr')[1];
    expect(fila.textContent).toContain('Sin título');
    expect(fila.textContent).toContain('No registra');
    expect(fila.querySelector('a')?.getAttribute('href')).toBe('/obra/15');
  });

  it('una ubicación que no llegó en la lectura se muestra como «No registra», nunca «undefined»', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TablaObrasComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TablaObrasComponent);
    const { ubicacion, ...sinUbicacion } = obraDePrueba();
    fixture.componentRef.setInput('obras', [sinUbicacion]);
    fixture.componentRef.setInput('esAdmin', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('undefined');
  });
});
