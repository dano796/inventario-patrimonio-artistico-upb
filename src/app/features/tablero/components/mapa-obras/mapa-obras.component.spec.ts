import { Component, input, model } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MapaObrasComponent } from './mapa-obras.component';
import { TableroService } from '../../tablero.service';
import { BloqueContado, ObraTablero } from '../../tablero';
import { MapaCampusComponent } from '../mapa-campus/mapa-campus.component';

@Component({ selector: 'app-mapa-campus', template: '' })
class MapaSimulado {
  bloques = input.required<BloqueContado[]>();
  elegido = model<number | null>(null);
  relleno = input<unknown>();
}

const obra = (id: number, o: Partial<ObraTablero> = {}): ObraTablero => ({
  id, titulo: `Obra ${id}`, autor: 'Ana', tecnica: 'Óleo', ubicacion: 'Bloque 6', bloque: 'BLOQUE 6', responsable: 'JOBANY',
  fechaCreacion: null, imagenes: 1, ano: null, valor: null, ...o,
});

async function montar(obras: Promise<ObraTablero[]>) {
  const servicio = { obras: jasmine.createSpy('obras').and.returnValue(obras) };
  TestBed.configureTestingModule({
    imports: [MapaObrasComponent],
    providers: [provideRouter([]), { provide: TableroService, useValue: servicio }],
  });
  TestBed.overrideComponent(MapaObrasComponent, { remove: { imports: [MapaCampusComponent] }, add: { imports: [MapaSimulado] } });
  const fixture = TestBed.createComponent(MapaObrasComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, servicio, html: fixture.nativeElement as HTMLElement };
}

describe('MapaObrasComponent', () => {
  it('muestra el plano, las obras sin bloque y la lista de bloques', async () => {
    const { html } = await montar(Promise.resolve([obra(1), obra(2, { bloque: 'BLOQUE 15' }), obra(3, { bloque: null })]));
    expect(html.querySelector('app-mapa-campus')).not.toBeNull();
    expect(html.textContent).toContain('Dónde están las obras');
    expect(html.textContent).toContain('1 obras sin bloque, fuera del plano');
    expect(html.textContent).toContain('Bloque 6');
    expect(html.textContent).toContain('Biblioteca Central');
  });

  it('elegir un bloque muestra sus lugares y se lo pasa al mapa', async () => {
    const { fixture, html } = await montar(Promise.resolve([obra(1, { ubicacion: 'Bloque 6 Piso 2' }), obra(2, { bloque: 'BLOQUE 15' })]));
    const fila = [...html.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent?.includes('Bloque 6')) as HTMLButtonElement;
    fila.click();
    fixture.detectChanges();
    expect(fila.getAttribute('aria-pressed')).toBe('true');
    expect(html.querySelector('[aria-label="Lugares dentro de Bloque 6"]')?.textContent).toContain('Bloque 6 Piso 2');
    const mapa = fixture.debugElement.query((d) => d.componentInstance instanceof MapaSimulado).componentInstance as MapaSimulado;
    expect(mapa.elegido()).toBe(6);
  });

  it('abrir un lugar muestra sus obras con enlace a la ficha, y las que no tienen ubicación van aparte', async () => {
    const { fixture, html } = await montar(Promise.resolve([obra(1, { ubicacion: 'Piso 2', titulo: null }), obra(2, { ubicacion: null })]));
    (html.querySelector('button[aria-pressed]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const lugar = (texto: string) => [...html.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement;
    lugar('Piso 2').click();
    fixture.detectChanges();
    const lista = html.querySelector('[aria-label="Obras en Piso 2"]')!;
    expect(lista.textContent).toContain('Sin título');
    expect(lista.querySelector('a')?.getAttribute('href')).toBe('/obra/1');
    lugar('Sin ubicación registrada').click();
    fixture.detectChanges();
    expect(html.querySelector('[aria-label="Obras en Piso 2"]')).toBeNull();
    expect(html.querySelector('[aria-label="Obras en ubicación sin registrar"] a')?.getAttribute('href')).toBe('/obra/2');
  });

  it('un error ofrece reintentar', async () => {
    const { fixture, servicio, html } = await montar(Promise.reject(new Error('sin red')));
    servicio.obras.and.resolveTo([obra(1)]);
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reintentar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.obras).toHaveBeenCalledTimes(2);
    expect(html.querySelector('app-mapa-campus')).not.toBeNull();
  });
});
