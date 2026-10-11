import { TestBed } from '@angular/core/testing';
import { SincronizacionService } from './sincronizacion.service';
import { ErrorGraph, GraphService } from './graph.service';
import { SincronizacionDatosService } from './sincronizacion-datos.service';
import { crearXlsxDePrueba } from '../nucleo/pruebas/xlsx-de-prueba';
import { ENCABEZADOS_HOJA, FilaDePrueba, rangoDePrueba } from '../nucleo/pruebas/rango-de-prueba';
import { camposVacios, obraBase } from '../nucleo/pruebas/fabricas';
import { columnaALetra } from '../nucleo/rangos';
import { camposFoto, ValoresFoto } from '../nucleo/foto';
import { CamposObra } from '../nucleo/hoja-obras';
import { ObraBase } from '../nucleo/importacion';
import { decisionesPorDefecto } from '../nucleo/plan-ejecucion';
import { MOTIVO_CELDA_CAMBIADA } from '../nucleo/verificar-hoja';

const HOJA = { drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: 'etag-1' };
const SIN_RESULTADO = { aplicados: 0, descartados: [], creadas: [] };

function xlsx(filas: FilaDePrueba[]): Uint8Array {
  const columna = (encabezado: string) => columnaALetra(ENCABEZADOS_HOJA.indexOf(encabezado as never) + 1);
  return crearXlsxDePrueba({
    celdas: [
      ...ENCABEZADOS_HOJA.map((texto) => ({ ref: `${columna(texto)}1`, texto })),
      ...filas.flatMap((fila, i) =>
        Object.entries(fila).map(([encabezado, valor]) => {
          const ref = `${columna(encabezado)}${i + 2}`;
          return typeof valor === 'number' ? { ref, numero: valor } : { ref, texto: String(valor) };
        })
      ),
    ],
  });
}

const foto = (campos: Partial<CamposObra>) => camposFoto({ ...camposVacios(), ...campos });

function montar(opciones: { hoja: FilaDePrueba[]; segundaLectura?: FilaDePrueba[]; obras: ObraBase[]; fotos: [number, ValoresFoto][] }) {
  const graph = {
    descargar: jasmine.createSpy('descargar').and.resolveTo(xlsx(opciones.hoja)),
    leerRangoUsado: jasmine.createSpy('leerRangoUsado').and.resolveTo(rangoDePrueba(opciones.segundaLectura ?? opciones.hoja)),
    escribirValores: jasmine.createSpy('escribirValores').and.resolveTo(undefined),
    archivo: jasmine.createSpy('archivo').and.resolveTo({ eTag: 'etag-2' }),
  };
  const datos = {
    hojaVinculada: jasmine.createSpy('hojaVinculada').and.resolveTo(HOJA),
    obras: jasmine.createSpy('obras').and.resolveTo(opciones.obras),
    responsables: jasmine.createSpy('responsables').and.resolveTo([]),
    fotos: jasmine.createSpy('fotos').and.resolveTo(new Map(opciones.fotos)),
    aplicar: jasmine.createSpy('aplicar').and.resolveTo(SIN_RESULTADO),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: GraphService, useValue: graph },
      { provide: SincronizacionDatosService, useValue: datos },
    ],
  });
  return { servicio: TestBed.inject(SincronizacionService), graph, datos };
}

describe('SincronizacionService', () => {
  it('calcular descarga la hoja vinculada y propone llevar a la base lo que cambió en ella', async () => {
    const { servicio, graph } = montar({
      hoja: [{ TITULO: 'Paisaje', 'UBICACIÓN': 'Bloque 11', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', ubicacion: 'Bloque 6' })],
      fotos: [[14, foto({ titulo: 'Paisaje', ubicacion: 'Bloque 6' })]],
    });

    const calculo = await servicio.calcular();

    expect(graph.descargar).toHaveBeenCalledWith('d', 'i');
    expect(calculo.diff.cambios.map((c) => [c.obraId, c.campo, c.destino])).toEqual([[14, 'ubicacion', 'base']]);
  });

  it('aplicar escribe en la fila donde está ahora el ID WEB y registra la foto y el eTag al terminar', async () => {
    const { servicio, graph, datos } = montar({
      hoja: [{ TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      segundaLectura: [{ TITULO: 'Otra', 'ID WEB': 99 }, { TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', observaciones: 'Nota corregida' })],
      fotos: [[14, foto({ titulo: 'Paisaje', observaciones: 'Nota' })]],
    });
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));

    expect(graph.escribirValores).toHaveBeenCalledOnceWith('d', 'i', 'Inventario Obras', 'M3:M3', [['Nota corregida']]);
    expect(datos.aplicar.calls.mostRecent().args[0]).toEqual({
      campos: [], cargos: [], altas: [],
      fotos: [{ obra_id: 14, valores: { observaciones: 'Nota corregida' } }],
      hoja: { etag: 'etag-2' },
    });
    expect(resultado.escritasEnHoja).toBe(1);
    expect(resultado.error).toBeNull();
  });

  it('si el token caduca a mitad, registra en la foto solo lo escrito, no guarda el eTag y avisa', async () => {
    const { servicio, graph, datos } = montar({
      hoja: [{ TITULO: 'Paisaje', 'UBICACIÓN': 'Bloque 6', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', ubicacion: 'Bloque 3', observaciones: 'Nota corregida' })],
      fotos: [[14, foto({ titulo: 'Paisaje', ubicacion: 'Bloque 6', observaciones: 'Nota' })]],
    });
    let escrituras = 0;
    graph.escribirValores.and.callFake(async () => {
      if (++escrituras === 2) throw new ErrorGraph(401, 'caducado');
    });
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));

    expect(resultado.error).toMatch(/caducó/);
    expect(resultado.escritasEnHoja).toBe(1);
    expect(datos.aplicar.calls.mostRecent().args[0]).toEqual({
      campos: [], cargos: [], altas: [], fotos: [{ obra_id: 14, valores: { ubicacion: 'Bloque 3' } }],
    });
  });

  it('no escribe una celda que cambió desde el diff y la informa', async () => {
    const { servicio, graph } = montar({
      hoja: [{ TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      segundaLectura: [{ TITULO: 'Paisaje', OBSERVACIONES: 'Otra nota', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', observaciones: 'Nota corregida' })],
      fotos: [[14, foto({ titulo: 'Paisaje', observaciones: 'Nota' })]],
    });
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));

    expect(graph.escribirValores).not.toHaveBeenCalled();
    expect(resultado.descartadasEnHoja.map((d) => d.motivo)).toEqual([MOTIVO_CELDA_CAMBIADA]);
  });

  it('escribe el ID WEB en la fila de una obra creada desde la hoja', async () => {
    const { servicio, graph, datos } = montar({ hoja: [{ AUTOR: 'Ana', TITULO: 'Nueva' }], obras: [], fotos: [] });
    datos.aplicar.and.returnValues(
      Promise.resolve({ aplicados: 0, descartados: [], creadas: [{ fila: 2, obra_id: 700 }] }),
      Promise.resolve(SIN_RESULTADO)
    );
    const calculo = await servicio.calcular();

    await servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) });

    expect(datos.aplicar.calls.argsFor(0)[0].altas.map((a: { fila: number }) => a.fila)).toEqual([2]);
    expect(graph.escribirValores).toHaveBeenCalledOnceWith('d', 'i', 'Inventario Obras', 'R2:R2', [[700]]);
  });
});

describe('SincronizacionService, protecciones al aplicar', () => {
  it('no toca la base si antes no puede leer la hoja', async () => {
    const { servicio, graph, datos } = montar({ hoja: [{ AUTOR: 'Ana', TITULO: 'Nueva' }], obras: [], fotos: [] });
    graph.leerRangoUsado.and.rejectWith(new ErrorGraph(401, 'caducado'));
    const calculo = await servicio.calcular();

    await expectAsync(servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) })).toBeRejected();

    expect(datos.aplicar).not.toHaveBeenCalled();
  });

  it('escribe el ID WEB de las obras nuevas antes que cualquier otro campo', async () => {
    const { servicio, graph, datos } = montar({
      hoja: [{ AUTOR: 'Ana', TITULO: 'Nueva' }, { TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', observaciones: 'Nota corregida' })],
      fotos: [[14, foto({ titulo: 'Paisaje', observaciones: 'Nota' })]],
    });
    datos.aplicar.and.returnValues(
      Promise.resolve({ aplicados: 0, descartados: [], creadas: [{ fila: 2, obra_id: 700 }] }),
      Promise.resolve(SIN_RESULTADO)
    );
    const calculo = await servicio.calcular();

    await servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) });

    expect(graph.escribirValores.calls.allArgs().map((a) => a[3])).toEqual(['R2:R2', 'M3:M3']);
  });

  it('no deja aplicar dos veces el mismo cálculo, aunque el primer intento fallara', async () => {
    const { servicio, graph, datos } = montar({ hoja: [{ AUTOR: 'Ana', TITULO: 'Nueva' }], obras: [], fotos: [] });
    graph.leerRangoUsado.and.rejectWith(new ErrorGraph(401, 'caducado'));
    const calculo = await servicio.calcular();
    const decisiones = { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) };
    await expectAsync(servicio.aplicar(calculo, decisiones)).toBeRejected();
    graph.leerRangoUsado.and.resolveTo(rangoDePrueba([{ AUTOR: 'Ana', TITULO: 'Nueva' }]));

    await expectAsync(servicio.aplicar(calculo, decisiones)).toBeRejectedWithError(/calcular/i);

    expect(datos.aplicar).not.toHaveBeenCalled();
  });

  it('calcular aborta si la hoja no tiene la columna ID WEB', async () => {
    const { servicio, graph } = montar({ hoja: [], obras: [], fotos: [] });
    const sinIdWeb = ENCABEZADOS_HOJA.filter((e) => e !== 'ID WEB');
    graph.descargar.and.resolveTo(
      crearXlsxDePrueba({ celdas: sinIdWeb.map((texto, i) => ({ ref: `${columnaALetra(i + 1)}1`, texto })) })
    );

    await expectAsync(servicio.calcular()).toBeRejectedWithError(/ID WEB/);
  });
});
