import { TestBed } from '@angular/core/testing';
import { BarraFiltrosComponent } from './barra-filtros.component';
import { chipsFiltros, ValoresFiltros } from '../../../utils/galeria';

const valores = (v: Partial<ValoresFiltros> = {}): ValoresFiltros => ({
  busqueda: '', ubicacion: '', ubicaciones: [], responsable: '', autor: '', tecnica: '', ...v,
});

function montar(esAdmin: boolean, v: ValoresFiltros = valores()) {
  TestBed.configureTestingModule({ imports: [BarraFiltrosComponent] });
  const fixture = TestBed.createComponent(BarraFiltrosComponent);
  fixture.componentRef.setInput('valores', v);
  fixture.componentRef.setInput('chips', chipsFiltros(v, esAdmin));
  fixture.componentRef.setInput('esAdmin', esAdmin);
  fixture.componentRef.setInput('abierto', true);
  fixture.detectChanges();
  return { fixture, html: fixture.nativeElement as HTMLElement };
}

describe('BarraFiltrosComponent', () => {
  it('sin rol de administrador solo ofrece autor y técnica en el panel', () => {
    const etiquetas = [...montar(false).html.querySelectorAll('#panel-filtros label')].map((l) => l.textContent?.trim());
    expect(etiquetas).toEqual(['Autor', 'Técnica']);
  });

  it('un administrador también filtra por ubicación y responsable', () => {
    const etiquetas = [...montar(true).html.querySelectorAll('#panel-filtros label')].map((l) => l.textContent?.trim());
    expect(etiquetas).toEqual(['Ubicación', 'Responsable', 'Autor', 'Técnica']);
  });

  it('emite el cambio de cada campo con su clave', () => {
    const { fixture, html } = montar(false);
    const cambios: unknown[] = [];
    fixture.componentInstance.cambio.subscribe((c) => cambios.push(c));
    const autor = html.querySelector('#filtro-autor') as HTMLInputElement;
    autor.value = 'Londoño';
    autor.dispatchEvent(new Event('input'));
    expect(cambios).toEqual([{ clave: 'autor', valor: 'Londoño' }]);
  });

  it('muestra un chip por filtro activo y emite el que se quita', () => {
    const { fixture, html } = montar(false, valores({ autor: 'Ana' }));
    const quitados: unknown[] = [];
    fixture.componentInstance.quitar.subscribe((c) => quitados.push(c));
    (html.querySelector('button[aria-label="Quitar filtro Autor: Ana"]') as HTMLButtonElement).click();
    expect(quitados).toEqual([{ clave: 'autor', valor: 'Ana', texto: 'Autor: Ana' }]);
  });

  it('cuenta los filtros del panel, sin la búsqueda', () => {
    const { html } = montar(false, valores({ busqueda: 'x', autor: 'Ana' }));
    expect(html.querySelector('[data-contador-filtros]')?.textContent?.trim()).toBe('1');
  });
});
