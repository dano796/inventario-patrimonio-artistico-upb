import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  it('sin rol de administrador no tiene columna de ubicación', () => {
    const html = montar(false);
    expect(html.querySelector('thead')?.textContent).not.toContain('Ubicación');
    expect(html.textContent).not.toContain('Bloque 6');
  });

  it('un administrador ve la ubicación', () => {
    const html = montar(true);
    expect(html.querySelector('thead')?.textContent).toContain('Ubicación');
    expect(html.textContent).toContain('Bloque 6');
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
