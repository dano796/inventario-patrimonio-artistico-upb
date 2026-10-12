import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VincularHojaComponent } from './vincular-hoja.component';
import { GraphService } from '../../services/graph.service';
import { SincronizacionDatosService } from '../../services/sincronizacion-datos.service';
import { IdWebService } from '../../services/id-web.service';

async function montar(conectado: boolean) {
  TestBed.configureTestingModule({
    imports: [VincularHojaComponent],
    providers: [
      provideRouter([]),
      { provide: GraphService, useValue: { tieneAccesoArchivos: async () => conectado, conectar: jasmine.createSpy('conectar') } },
      { provide: SincronizacionDatosService, useValue: { hojaVinculada: async () => ({ drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: null }) } },
      { provide: IdWebService, useValue: {} },
    ],
  });
  const fixture = TestBed.createComponent(VincularHojaComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
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
});
