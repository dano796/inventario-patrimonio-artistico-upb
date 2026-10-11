import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TableroComponent } from './tablero.component';
import { TableroService } from '../../tablero.service';
import { ArtworkExportService } from '../../../artworks/services/artwork-export.service';
import { ObraTablero } from '../../tablero';

const obra = (id: number, o: Partial<ObraTablero> = {}): ObraTablero => ({
  id, titulo: `Obra ${id}`, autor: 'Ana', tecnica: 'Óleo', ubicacion: 'Bloque 6', responsable: 'JOBANY',
  fechaCreacion: null, imagenes: 1, ...o,
});

async function montar(obras: Promise<ObraTablero[]>) {
  const servicio = { obras: jasmine.createSpy('obras').and.returnValue(obras) };
  TestBed.configureTestingModule({
    imports: [TableroComponent],
    providers: [
      provideRouter([]),
      { provide: TableroService, useValue: servicio },
      { provide: ArtworkExportService, useValue: { exportToExcel: jasmine.createSpy('exportToExcel').and.resolveTo(3) } },
    ],
  });
  const fixture = TestBed.createComponent(TableroComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, servicio, html: fixture.nativeElement as HTMLElement };
}

describe('TableroComponent', () => {
  it('muestra las cifras, las ubicaciones y las fichas por completar', async () => {
    const { html } = await montar(Promise.resolve([obra(1), obra(2, { autor: null }), obra(3, { ubicacion: 'Biblioteca', imagenes: 0 })]));
    expect(html.textContent).toContain('Estado del inventario');
    expect(html.textContent).toContain('Obras registradas');
    expect(html.textContent).toContain('67 % del inventario');
    expect(html.textContent).toContain('Bloque 6');
    expect(html.textContent).toContain('Sin autor registrado');
    expect(html.textContent).not.toContain('Movimientos recientes');
  });

  it('«Revisar» despliega las obras de esa fila con enlace a su ficha', async () => {
    const { fixture, html } = await montar(Promise.resolve([obra(1), obra(2, { autor: null, titulo: null })]));
    const revisar = html.querySelector('button[aria-controls="pendientes-autor"]') as HTMLButtonElement;
    revisar.click();
    fixture.detectChanges();
    const lista = html.querySelector('#pendientes-autor')!;
    expect(lista.textContent).toContain('Sin título');
    expect(lista.querySelector('a')?.getAttribute('href')).toBe('/obra/2');
    expect(revisar.getAttribute('aria-expanded')).toBe('true');
  });

  it('un error ofrece reintentar', async () => {
    const { fixture, servicio, html } = await montar(Promise.reject(new Error('sin red')));
    expect(html.textContent).toContain('No se pudo cargar el tablero.');
    servicio.obras.and.resolveTo([obra(1)]);
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reintentar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.obras).toHaveBeenCalledTimes(2);
    expect(html.textContent).toContain('Obras registradas');
  });
});
