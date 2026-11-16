import { TestBed } from '@angular/core/testing';
import { PaginacionComponent, paginasVisibles } from './paginacion.component';

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
  });

  it('desactiva anterior en la primera página y siguiente en la última', () => {
    expect((montar(1, 15).html.querySelector('button[aria-label="Página anterior"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((montar(15, 15).html.querySelector('button[aria-label="Página siguiente"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('muestra la primera, la última y las vecinas de la actual, con puntos suspensivos entre medias', () => {
    const { html } = montar(4, 10);
    const textos = [...html.querySelectorAll('nav li')].map((li) => li.textContent?.trim());
    expect(textos).toEqual(['1', '…', '3', '4', '5', '…', '10']);
    expect(html.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('4');
    expect(html.textContent).not.toContain('Ir a la página');
  });

  it('pulsar un número pide esa página y pulsar la actual no pide nada', () => {
    const { html, pedidas } = montar(4, 10);
    (html.querySelector('button[aria-label="Página 10"]') as HTMLButtonElement).click();
    (html.querySelector('button[aria-label="Página 4"]') as HTMLButtonElement).click();
    expect(pedidas).toEqual([10]);
  });

  it('con una sola página no se muestra', () => {
    expect(montar(1, 1).html.querySelector('nav')).toBeNull();
  });
});

describe('paginasVisibles', () => {
  it('pone puntos suspensivos donde se saltan páginas', () => {
    expect(paginasVisibles(4, 10)).toEqual([1, null, 3, 4, 5, null, 10]);
    expect(paginasVisibles(1, 22)).toEqual([1, 2, null, 22]);
    expect(paginasVisibles(2, 22)).toEqual([1, 2, 3, null, 22]);
    expect(paginasVisibles(22, 22)).toEqual([1, null, 21, 22]);
    expect(paginasVisibles(2, 3)).toEqual([1, 2, 3]);
    expect(paginasVisibles(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
