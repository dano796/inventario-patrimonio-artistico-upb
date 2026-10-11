import { TestBed } from '@angular/core/testing';
import { PaginacionComponent } from './paginacion.component';

function montar(paginaActual: number, totalPaginas: number) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [PaginacionComponent] });
  const fixture = TestBed.createComponent(PaginacionComponent);
  fixture.componentRef.setInput('paginaActual', paginaActual);
  fixture.componentRef.setInput('totalPaginas', totalPaginas);
  const pedidas: number[] = [];
  fixture.componentInstance.irA.subscribe((p) => pedidas.push(p));
  fixture.detectChanges();
  return { fixture, pedidas, html: fixture.nativeElement as HTMLElement };
}

describe('PaginacionComponent', () => {
  it('pide la página siguiente y la anterior', () => {
    const { html, pedidas } = montar(3, 15);
    (html.querySelector('button[aria-label="Página siguiente"]') as HTMLButtonElement).click();
    (html.querySelector('button[aria-label="Página anterior"]') as HTMLButtonElement).click();
    expect(pedidas).toEqual([4, 2]);
    expect(html.textContent).toContain('de 15');
  });

  it('desactiva anterior en la primera página y siguiente en la última', () => {
    expect((montar(1, 15).html.querySelector('button[aria-label="Página anterior"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((montar(15, 15).html.querySelector('button[aria-label="Página siguiente"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('ir a la página solo acepta números de página válidos', () => {
    const { fixture, pedidas } = montar(3, 15);
    for (const valor of ['7', '0', '16', 'abc', '3', '2.5']) fixture.componentInstance.ir(valor);
    expect(pedidas).toEqual([7]);
  });

  it('con una sola página no se muestra', () => {
    expect(montar(1, 1).html.querySelector('nav')).toBeNull();
  });
});
