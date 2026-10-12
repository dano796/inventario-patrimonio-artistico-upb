import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SincronizarComponent } from './sincronizar.component';
import { Calculo, SincronizacionService } from '../../services/sincronizacion.service';
import { ErrorGraph, GraphService } from '../../services/graph.service';
import { HojaVinculada, SincronizacionDatosService } from '../../services/sincronizacion-datos.service';
import { ErrorEncabezados } from '../../nucleo/hoja-obras';
import { calculoDePrueba } from '../../utils/calculo-de-prueba';
import { obraBase } from '../../nucleo/pruebas/fabricas';
import { borrarBorrador } from '../../utils/borrador';

@Component({ template: '' })
class Vacia {}

const HOJA: HojaVinculada = { drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: '2026-09-19T15:12:00Z', etag: 'e' };
const SIN_RESULTADO = { base: { aplicados: 0, descartados: [], creadas: [] }, escritasEnHoja: 0, altasEnHoja: 0, descartadasEnHoja: [], error: null };

const conConflicto = (): Calculo =>
  calculoDePrueba(
    {
      cambios: [{ obraId: 14, fila: 15, campo: 'ubicacion', destino: 'base', hoja: 'Bloque 11', base: 'Bloque 6', foto: 'Bloque 6' }],
      conflictos: [{ obraId: 31, fila: 32, campo: 'ubicacion', hoja: 'Bloque 11', base: 'Bloque 3', foto: 'Bloque 6' }],
    },
    { obras: [obraBase(14, { titulo: 'Retrato del Fundador' }), obraBase(31, { titulo: 'Paisaje sin título' })] }
  );

async function montarPagina(opciones: {
  hoja?: HojaVinculada | null;
  conectado?: boolean;
  calcular?: () => Promise<Calculo>;
}) {
  const servicio = {
    calcular: jasmine.createSpy('calcular').and.callFake(opciones.calcular ?? (async () => conConflicto())),
    aplicar: jasmine.createSpy('aplicar').and.resolveTo(SIN_RESULTADO),
  };
  const graph = {
    tieneAccesoArchivos: jasmine.createSpy('tieneAccesoArchivos').and.resolveTo(opciones.conectado ?? true),
    conectar: jasmine.createSpy('conectar').and.resolveTo(undefined),
    archivo: jasmine.createSpy('archivo').and.resolveTo({ name: 'Inventario Patrimonio Artístico.xlsx' }),
  };
  const datos = { hojaVinculada: jasmine.createSpy('hojaVinculada').and.resolveTo(opciones.hoja === undefined ? HOJA : opciones.hoja) };
  TestBed.configureTestingModule({
    imports: [SincronizarComponent],
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
      { provide: SincronizacionService, useValue: servicio },
      { provide: GraphService, useValue: graph },
      { provide: SincronizacionDatosService, useValue: datos },
    ],
  });
  const fixture = TestBed.createComponent(SincronizarComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const html = fixture.nativeElement as HTMLElement;
  const actualizar = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const boton = (texto: string) => [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;
  return { fixture, html, servicio, graph, datos, actualizar, boton };
}

describe('SincronizarComponent: entrada y comparación', () => {
  afterEach(() => borrarBorrador());

  it('sin conexión con OneDrive ofrece conectar y vuelve a esta pantalla', async () => {
    const { html, graph, servicio, boton } = await montarPagina({ conectado: false });

    expect(html.textContent).toContain('Conecta con OneDrive para leer la hoja');
    expect(html.textContent).toContain('OneDrive sin conectar');
    expect(servicio.calcular).not.toHaveBeenCalled();
    boton('Conectar con OneDrive').click();

    expect(graph.conectar).toHaveBeenCalledOnceWith('/sincronizacion');
  });

  it('con conexión compara sola y muestra la revisión', async () => {
    const { html, servicio } = await montarPagina({});

    expect(servicio.calcular).toHaveBeenCalledTimes(1);
    expect(html.textContent).toContain('OneDrive conectado');
    expect(html.textContent).toContain('Inventario Patrimonio Artístico.xlsx');
    expect(html.textContent).toContain('Retrato del Fundador');
    expect(html.textContent).toContain('Paisaje sin título');
  });

  it('si falta un encabezado se detiene y lo señala entre los esperados', async () => {
    const { html } = await montarPagina({ calcular: () => Promise.reject(new ErrorEncabezados(['UBICACIÓN'])) });

    expect(html.textContent).toContain('No se encontró el encabezado «UBICACIÓN»');
    expect(html.textContent).toContain('UBICACIÓN · no encontrado');
    expect(html.textContent).toContain('AUTOR');
  });

  it('otro error al comparar ofrece volver a intentarlo', async () => {
    const { html, servicio, boton, actualizar } = await montarPagina({ calcular: () => Promise.reject(new Error('sin red')) });

    expect(html.textContent).toContain('No se pudo comparar');
    expect(html.textContent).toContain('sin red');
    servicio.calcular.and.callFake(async () => conConflicto());
    boton('Volver a intentar').click();
    await actualizar();

    expect(html.textContent).toContain('Retrato del Fundador');
  });

  it('si el token caducó al comparar vuelve a ofrecer conectar', async () => {
    const { html } = await montarPagina({ calcular: () => Promise.reject(new ErrorGraph(401, 'caducado')) });
    expect(html.textContent).toContain('Conecta con OneDrive para leer la hoja');
  });

  it('sin diferencias lo dice y registra la sincronización', async () => {
    const { html, servicio } = await montarPagina({ calcular: async () => calculoDePrueba({}, { obras: [obraBase(1, {})] }) });

    expect(html.textContent).toContain('La hoja y el inventario coinciden');
    expect(servicio.aplicar).toHaveBeenCalledTimes(1);
  });

  it('sin hoja vinculada lleva a vincularla', async () => {
    const { html, graph } = await montarPagina({ hoja: null });

    expect(html.querySelector('a[href="/sincronizacion/vincular"]')).not.toBeNull();
    expect(graph.tieneAccesoArchivos).not.toHaveBeenCalled();
  });
});
