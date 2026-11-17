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
import { ACCESO_HOJA, ErrorLibroDistinto } from '../../services/acceso-hoja';

@Component({ template: '' })
class Vacia {}

const HOJA: HojaVinculada = { drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: '2026-09-19T15:12:00Z', etag: 'e', url: null };
const SIN_RESULTADO = { base: { aplicados: 0, descartados: [], creadas: [] }, escritasEnHoja: 0, altasEnHoja: 0, descartadasEnHoja: [], imagenesSubidas: 0, imagenesFallidas: [], error: null };

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
  excel?: boolean;
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
  const datos = {
    hojaVinculada: jasmine.createSpy('hojaVinculada').and.resolveTo(opciones.hoja === undefined ? HOJA : opciones.hoja),
    vincularLibro: jasmine.createSpy('vincularLibro').and.resolveTo(undefined),
  };
  const excel = {
    origen: 'excel' as const,
    conectado: async () => true,
    nombre: async () => 'Inventario Patrimonio UPB 1.xlsx',
  };
  TestBed.configureTestingModule({
    imports: [SincronizarComponent],
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
      { provide: SincronizacionService, useValue: servicio },
      { provide: GraphService, useValue: graph },
      { provide: SincronizacionDatosService, useValue: datos },
      ...(opciones.excel ? [{ provide: ACCESO_HOJA, useValue: excel }] : []),
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
  const boton = (texto: string) => [...html.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === texto) as HTMLButtonElement;
  return { fixture, html, servicio, graph, datos, actualizar, boton };
}

describe('SincronizarComponent: entrada y comparación', () => {
  afterEach(() => borrarBorrador());

  it('sin conexión con OneDrive ofrece conectar y vuelve a esta pantalla', async () => {
    const { html, graph, servicio, boton } = await montarPagina({ conectado: false });

    expect(html.textContent).toContain('Conexión con OneDrive');
    expect(html.textContent).toContain('OneDrive sin conectar');
    expect(html.textContent).not.toContain('Antes de continuar');
    expect(html.textContent).not.toContain('La conexión dura esta visita');
    expect(servicio.calcular).not.toHaveBeenCalled();
    boton('Conectar con OneDrive').click();

    expect(graph.conectar).toHaveBeenCalledOnceWith('/sincronizacion');
  });

  it('mientras redirige a Microsoft lo dice en el botón', async () => {
    const { graph, boton, actualizar } = await montarPagina({ conectado: false });
    graph.conectar.and.returnValue(new Promise(() => undefined));

    boton('Conectar con OneDrive').click();
    await actualizar();

    expect(boton('Conectando…').disabled).toBeTrue();
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

    expect(html.textContent).toContain('No se encontró el encabezado "UBICACIÓN"');
    expect(html.textContent).toContain('UBICACIÓN (no encontrado)');
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

  it('si el Excel vinculado ya no está en OneDrive lo explica y ofrece vincularla de nuevo', async () => {
    const { html } = await montarPagina({
      calcular: () => Promise.reject(new ErrorGraph(404, '{"error":{"code":"itemNotFound","message":"The resource could not be found."}}')),
    });

    expect(html.textContent).toContain('No se encontró el Excel vinculado');
    expect(html.textContent).not.toContain('itemNotFound');
    expect(html.textContent).not.toContain('Sincronización detenida');
    expect(html.querySelector('[role="alert"]')).toBeNull();
    expect(html.querySelector('a[href="/sincronizacion/vincular"]')?.textContent?.trim()).toBe('Vincular el Excel');
  });

  it('si el token caducó al comparar vuelve a ofrecer conectar', async () => {
    const { html } = await montarPagina({ calcular: () => Promise.reject(new ErrorGraph(401, 'caducado')) });
    expect(html.textContent).toContain('Conexión con OneDrive');
  });

  it('sin diferencias lo dice y registra la sincronización', async () => {
    const { html, servicio } = await montarPagina({ calcular: async () => calculoDePrueba({}, { obras: [obraBase(1, {})] }) });

    expect(html.textContent).toContain('El Excel y el inventario coinciden');
    expect(servicio.aplicar).toHaveBeenCalledTimes(1);
  });

  it('sin hoja vinculada lleva a vincularla', async () => {
    const { html, graph } = await montarPagina({ hoja: null });

    expect(html.querySelector('a[href="/sincronizacion/vincular"]')).not.toBeNull();
    expect(graph.tieneAccesoArchivos).not.toHaveBeenCalled();
  });
});

describe('SincronizarComponent: revisar y aplicar', () => {
  afterEach(() => borrarBorrador());

  it('no deja aplicar con un conflicto sin decidir y aplica el lado elegido', async () => {
    const { servicio, boton, actualizar } = await montarPagina({});

    expect(boton('Aprobar y aplicar').disabled).toBeTrue();
    boton('Dejar el Excel').click();
    await actualizar();
    expect(boton('Aprobar y aplicar').disabled).toBeFalse();
    boton('Aprobar y aplicar').click();
    await actualizar();

    const decisiones = servicio.aplicar.calls.mostRecent().args[1];
    expect([...decisiones.conflictos]).toEqual([['31|ubicacion', 'hoja']]);
  });

  it('desmarcar un cambio lo deja fuera de lo que se aplica', async () => {
    const { html, servicio, boton, actualizar } = await montarPagina({});
    (html.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    boton('Dejar la base').click();
    await actualizar();
    boton('Aprobar y aplicar').click();
    await actualizar();

    expect([...servicio.aplicar.calls.mostRecent().args[1].descartados]).toEqual(['14|ubicacion']);
  });

  it('el filtro Conflictos deja solo las tarjetas con conflicto', async () => {
    const { html, boton, actualizar } = await montarPagina({});

    boton('Conflictos (1)').click();
    await actualizar();

    expect(html.textContent).not.toContain('Retrato del Fundador');
    expect(html.textContent).toContain('Paisaje sin título');
  });

  it('si la conexión caduca al aplicar, avisa, conserva las decisiones y reconecta', async () => {
    const { html, servicio, graph, boton, actualizar } = await montarPagina({});
    servicio.aplicar.and.rejectWith(new ErrorGraph(401, 'caducado'));
    boton('Dejar el Excel').click();
    await actualizar();
    boton('Aprobar y aplicar').click();
    await actualizar();

    expect(html.textContent).toContain('La conexión con OneDrive caducó al aplicar.');
    expect(html.textContent).toContain('Conexión caducada');
    boton('Reconectar y reintentar').click();
    await actualizar();

    expect(graph.conectar).toHaveBeenCalledOnceWith('/sincronizacion');
    expect(sessionStorage.getItem('sincronizacion-borrador')).not.toBeNull();
  });

  it('al volver con un borrador recupera las decisiones y lo anuncia', async () => {
    const primera = await montarPagina({});
    primera.boton('Dejar el Excel').click();
    await primera.actualizar();
    TestBed.resetTestingModule();

    const { html, boton } = await montarPagina({});

    expect(html.textContent).toContain('Decisiones recuperadas: 1 de 1.');
    expect(boton('Dejar el Excel').getAttribute('aria-pressed')).toBe('true');
    expect(boton('Aprobar y aplicar').disabled).toBeFalse();
  });

  it('tras aplicar muestra lo escrito y lo descartado, y olvida el borrador', async () => {
    const { html, servicio, boton, actualizar } = await montarPagina({});
    servicio.aplicar.and.resolveTo({
      base: { aplicados: 3, descartados: [{ obra_id: 14, campo: 'valor', motivo: 'cambió en la web desde el diff' }], creadas: [] },
      escritasEnHoja: 2, altasEnHoja: 1, descartadasEnHoja: [], imagenesSubidas: 0, imagenesFallidas: [], error: null,
    });
    boton('Dejar el Excel').click();
    await actualizar();
    boton('Aprobar y aplicar').click();
    await actualizar();

    expect(html.textContent).toContain('Campos escritos en la base');
    expect(html.textContent).toContain('Descartados por concurrencia');
    expect(html.textContent).toContain('N.º 14');
    expect(html.textContent).toContain('cambió en la web desde el diff');
    expect(sessionStorage.getItem('sincronizacion-borrador')).toBeNull();
    expect(html.textContent).not.toContain('Imágenes subidas');
    expect(html.textContent).not.toContain('Imágenes sin subir');
  });

  it('tras aplicar dice cuántas imágenes de las altas se subieron y cuáles no', async () => {
    const { html, servicio, boton, actualizar } = await montarPagina({});
    servicio.aplicar.and.resolveTo({
      ...SIN_RESULTADO,
      imagenesSubidas: 2,
      imagenesFallidas: [{ obraId: 721, fila: 536, casilla: 3, motivo: 'Payload too large' }],
    });
    boton('Dejar el Excel').click();
    await actualizar();
    boton('Aprobar y aplicar').click();
    await actualizar();

    expect(html.textContent).toContain('Imágenes subidas');
    expect(html.textContent).toContain('Imágenes sin subir');
    expect(html.textContent).toContain('N.º 721');
    expect(html.textContent).toContain('imagen_3');
    expect(html.textContent).toContain('Payload too large');
    expect(html.textContent).toContain('Deben subirse desde la ficha de la obra');
  });

  it('si el Excel no se terminó de escribir lo dice en el resultado', async () => {
    const { html, servicio, boton, actualizar } = await montarPagina({});
    servicio.aplicar.and.resolveTo({ ...SIN_RESULTADO, error: 'La conexión con OneDrive caducó.' });
    boton('Dejar el Excel').click();
    await actualizar();
    boton('Aprobar y aplicar').click();
    await actualizar();

    expect(html.textContent).toContain('No se terminó de escribir en el Excel.');
    expect(html.textContent).toContain('La conexión con OneDrive caducó.');
  });
});

describe('SincronizarComponent: desde el complemento de Excel', () => {
  afterEach(() => borrarBorrador());

  const otroLibro = (vinculado: string | null) => () =>
    Promise.reject(new ErrorLibroDistinto('https://upb/Documents/Inventario%20Patrimonio%20UPB%201.xlsx', vinculado));

  it('compara el libro abierto sin pedir conexión con OneDrive', async () => {
    const { html, servicio, graph } = await montarPagina({ excel: true });

    expect(graph.tieneAccesoArchivos).not.toHaveBeenCalled();
    expect(servicio.calcular).toHaveBeenCalledTimes(1);
    expect(html.textContent).toContain('Libro abierto en Excel');
    expect(html.textContent).toContain('Inventario Patrimonio UPB 1.xlsx');
  });

  it('la primera vez pide confirmar el libro y, al vincularlo, compara', async () => {
    let primera = true;
    const { html, datos, servicio, boton, actualizar } = await montarPagina({
      excel: true,
      calcular: () => (primera ? ((primera = false), otroLibro(null)()) : Promise.resolve(conConflicto())),
    });

    expect(html.textContent).toContain('Confirmación del libro oficial');
    expect(html.textContent).toContain('"Inventario Patrimonio UPB 1.xlsx"');
    boton('Vincular este libro').click();
    await actualizar();

    expect(datos.vincularLibro).toHaveBeenCalledOnceWith('https://upb/Documents/Inventario%20Patrimonio%20UPB%201.xlsx');
    expect(servicio.calcular).toHaveBeenCalledTimes(2);
    expect(html.textContent).toContain('Retrato del Fundador');
  });

  it('si el libro no es el vinculado lo dice y nombra los dos', async () => {
    const { html } = await montarPagina({ excel: true, calcular: otroLibro('https://upb/Documents/Inventario.xlsx') });

    expect(html.textContent).toContain('Este libro no es el Excel vinculado');
    expect(html.textContent).toContain('"Inventario Patrimonio UPB 1.xlsx"');
    expect(html.textContent).toContain('"Inventario.xlsx"');
  });

  it('sin hoja vinculada no enlaza a una página que no existe dentro de Excel', async () => {
    const { html } = await montarPagina({ excel: true, hoja: null });

    expect(html.textContent).toContain('Todavía no hay un Excel vinculado');
    expect(html.querySelector('a[href="/sincronizacion/vincular"]')).toBeNull();
  });
});
