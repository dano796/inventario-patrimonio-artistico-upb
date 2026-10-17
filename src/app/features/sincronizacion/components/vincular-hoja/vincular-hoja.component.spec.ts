import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VincularHojaComponent } from './vincular-hoja.component';
import { GraphService } from '../../services/graph.service';
import { SincronizacionDatosService } from '../../services/sincronizacion-datos.service';
import { IdWebService } from '../../services/id-web.service';

async function montar(conectado: boolean, buscarArchivos: (texto: string) => Promise<unknown[]> = async () => []) {
  TestBed.configureTestingModule({
    imports: [VincularHojaComponent],
    providers: [
      provideRouter([]),
      { provide: GraphService, useValue: { tieneAccesoArchivos: async () => conectado, conectar: jasmine.createSpy('conectar'), buscarArchivos } },
      { provide: SincronizacionDatosService, useValue: { hojaVinculada: async () => ({ drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: null }), vincular: async () => undefined } },
      { provide: IdWebService, useValue: {} },
    ],
  });
  const fixture = TestBed.createComponent(VincularHojaComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

async function buscar(html: HTMLElement) {
  (html.querySelector('button[type="submit"]') as HTMLButtonElement).click();
  await new Promise((ok) => setTimeout(ok));
  TestBed.tick();
}

describe('VincularHojaComponent', () => {
  for (const conectado of [false, true]) {
    it(`usa solo los colores del sistema visual (${conectado ? 'conectado' : 'sin conectar'})`, async () => {
      const html = await montar(conectado);

      expect(html.innerHTML).not.toMatch(/\b(?:bg|text|border|ring|hover:bg|hover:text)-(?:gray|blue|red|green|amber)-\d/);
      expect(html.querySelector('a[href="/sincronizacion"]')).not.toBeNull();
      expect(html.textContent).toContain('Vincular la hoja oficial');
    });
  }

  it('mientras busca lo dice en el botón', async () => {
    const html = await montar(true, () => new Promise(() => undefined));

    await buscar(html);

    expect(html.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Buscando…');
  });

  it('si no hay ningún .xlsx con ese nombre lo dice', async () => {
    const html = await montar(true);

    await buscar(html);

    expect(html.textContent).toContain('Ningún archivo .xlsx de tu OneDrive coincide con «Inventario».');
  });

  it('al vincular no dice que no encontró el archivo', async () => {
    const archivo = { id: 'x', name: 'Inventario.xlsx', eTag: 'e', parentReference: { driveId: 'd', path: '/drive/root:' } };
    const html = await montar(true, async () => [archivo]);
    await buscar(html);

    (Array.from(html.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Vincular') as HTMLButtonElement).click();
    await new Promise((ok) => setTimeout(ok));
    TestBed.tick();

    expect(html.textContent).toContain('Hoja vinculada: Inventario.xlsx');
    expect(html.textContent).not.toContain('Ningún archivo .xlsx');
  });
});
