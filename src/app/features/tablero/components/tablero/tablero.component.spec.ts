import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TableroComponent } from './tablero.component';
import { TableroService } from '../../tablero.service';
import { ArtworkExportService } from '../../../artworks/services/artwork-export.service';
import { ObraTablero } from '../../tablero';

const obra = (id: number, o: Partial<ObraTablero> = {}): ObraTablero => ({
  id, titulo: `Obra ${id}`, autor: 'Ana', tecnica: 'Óleo', ubicacion: 'Bloque 6', bloque: 'BLOQUE 6', responsable: 'JOBANY',
  fechaCreacion: null, imagenes: 1, ano: null, valor: null, ...o,
});

async function montar(
  obras: Promise<ObraTablero[]>
) {
  const servicio = {
    obras: jasmine.createSpy('obras').and.returnValue(obras),
  };
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
  it('muestra las cifras y las fichas por completar', async () => {
    const { html } = await montar(Promise.resolve([obra(1), obra(2, { autor: null }), obra(3, { bloque: 'BLOQUE 15', imagenes: 0 })]));
    expect(html.textContent).toContain('Estado del inventario');
    expect(html.textContent).toContain('Obras registradas');
    expect(html.textContent).toContain('67 % del inventario');
    expect(html.textContent).toContain('Valor estimado');
    expect(html.textContent).toContain('Completitud de las fichas');
    expect(html.querySelector('[aria-label="Sin autor registrado: 1"]')).not.toBeNull();
    expect(html.textContent).toContain('67 %');
    expect(html.textContent).toContain('Técnicas');
    expect(html.textContent).toContain('Artistas');
    expect(html.textContent).toContain('Épocas');
    expect(html.textContent).not.toContain('Movimientos recientes');
    expect(html.querySelector('a[href="/nueva"]')?.textContent?.trim()).toBe('Registrar obra');
  });

  it('«Revisar» lleva a la galería filtrada por el dato que falta', async () => {
    const { html } = await montar(Promise.resolve([obra(1), obra(2, { autor: null, titulo: null })]));
    const enlaces = [...html.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/?falta=autor');
    expect(enlaces).not.toContain('/?falta=tecnica');
    expect(html.textContent).toContain('Completo');
  });

  it('un error ofrece reintentar', async () => {
    const { fixture, servicio, html } = await montar(Promise.reject(new Error('sin red')));
    expect(html.textContent).toContain('No se pudo cargar el resumen.');
    servicio.obras.and.resolveTo([obra(1)]);
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reintentar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(servicio.obras).toHaveBeenCalledTimes(2);
    expect(html.textContent).toContain('Obras registradas');
  });
});
