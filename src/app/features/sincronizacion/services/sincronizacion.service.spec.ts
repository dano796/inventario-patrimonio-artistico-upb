import { TestBed } from '@angular/core/testing';
import { MARGEN_TOKEN_MIN, PasoCalculo, PREFIJO_BUCKET, SincronizacionService } from './sincronizacion.service';
import { ErrorGraph, GraphService } from './graph.service';
import { SincronizacionDatosService } from './sincronizacion-datos.service';
import { CeldaDePrueba, crearXlsxDePrueba } from '../nucleo/pruebas/xlsx-de-prueba';
import { ENCABEZADOS_HOJA, FilaDePrueba, rangoDePrueba } from '../nucleo/pruebas/rango-de-prueba';
import { camposVacios, obraBase } from '../nucleo/pruebas/fabricas';
import { columnaALetra } from '../nucleo/rangos';
import { camposFoto, ValoresFoto, valoresFoto } from '../nucleo/foto';
import { CamposObra } from '../nucleo/hoja-obras';
import { ObraBase } from '../nucleo/importacion';
import { decisionesPorDefecto } from '../nucleo/plan-ejecucion';
import { MOTIVO_CELDA_CAMBIADA } from '../nucleo/verificar-hoja';
import { ErrorEncabezados } from '../nucleo/hoja-obras';
import { ACCESO_HOJA, AccesoHoja, ErrorLibroDistinto } from './acceso-hoja';

const HOJA = { drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: 'etag-1', url: null };
const SIN_RESULTADO = { aplicados: 0, descartados: [], creadas: [] };

const columna = (encabezado: string) => columnaALetra(ENCABEZADOS_HOJA.indexOf(encabezado as never) + 1);

function xlsx(filas: FilaDePrueba[], imagenes: CeldaDePrueba[] = [], medios: Record<string, Uint8Array> = {}): Uint8Array {
  return crearXlsxDePrueba({
    medios,
    celdas: [
      ...ENCABEZADOS_HOJA.map((texto) => ({ ref: `${columna(texto)}1`, texto })),
      ...filas.flatMap((fila, i) =>
        Object.entries(fila).map(([encabezado, valor]) => {
          const ref = `${columna(encabezado)}${i + 2}`;
          return typeof valor === 'number' ? { ref, numero: valor } : { ref, texto: String(valor) };
        })
      ),
      ...imagenes,
    ],
  });
}

const foto = (campos: Partial<CamposObra>) => camposFoto({ ...camposVacios(), ...campos });

function montar(opciones: {
  hoja: FilaDePrueba[]; segundaLectura?: FilaDePrueba[]; obras: ObraBase[]; fotos: [number, ValoresFoto][];
  imagenes?: CeldaDePrueba[]; medios?: Record<string, Uint8Array>;
}) {
  const graph = {
    descargar: jasmine.createSpy('descargar').and.resolveTo(xlsx(opciones.hoja, opciones.imagenes, opciones.medios)),
    leerRangoUsado: jasmine.createSpy('leerRangoUsado').and.resolveTo(rangoDePrueba(opciones.segundaLectura ?? opciones.hoja)),
    escribirValores: jasmine.createSpy('escribirValores').and.resolveTo(undefined),
    archivo: jasmine.createSpy('archivo').and.resolveTo({ eTag: 'etag-2' }),
    minutosRestantes: jasmine.createSpy('minutosRestantes').and.resolveTo(60),
  };
  const datos = {
    hojaVinculada: jasmine.createSpy('hojaVinculada').and.resolveTo(HOJA),
    obras: jasmine.createSpy('obras').and.resolveTo(opciones.obras),
    responsables: jasmine.createSpy('responsables').and.resolveTo([]),
    fotos: jasmine.createSpy('fotos').and.resolveTo(new Map(opciones.fotos)),
    aplicar: jasmine.createSpy('aplicar').and.resolveTo(SIN_RESULTADO),
    subirImagen: jasmine.createSpy('subirImagen'),
  };
  let siguienteId = 901;
  datos.subirImagen.and.callFake(async () => siguienteId++);
  TestBed.configureTestingModule({
    providers: [
      { provide: GraphService, useValue: graph },
      { provide: SincronizacionDatosService, useValue: datos },
    ],
  });
  return { servicio: TestBed.inject(SincronizacionService), graph, datos };
}

describe('SincronizacionService', () => {
  it('calcular descarga el Excel vinculado y propone llevar a la base lo que cambió en ella', async () => {
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

    expect(graph.escribirValores).toHaveBeenCalledOnceWith('d', 'i', 'Inventario Obras', 'M3:M3', [["'Nota corregida"]]);
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

  it('si no puede leer el eTag al final, guarda igualmente la foto de lo escrito y avisa', async () => {
    const { servicio, graph, datos } = montar({
      hoja: [{ TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', observaciones: 'Nota corregida' })],
      fotos: [[14, foto({ titulo: 'Paisaje', observaciones: 'Nota' })]],
    });
    graph.archivo.and.rejectWith(new ErrorGraph(401, 'caducado'));
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));

    expect(resultado.escritasEnHoja).toBe(1);
    expect(resultado.error).toMatch(/caducó/);
    expect(datos.aplicar.calls.mostRecent().args[0]).toEqual({
      campos: [], cargos: [], altas: [], fotos: [{ obra_id: 14, valores: { observaciones: 'Nota corregida' } }],
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

  it('escribe el ID WEB en la fila de una obra creada desde el Excel', async () => {
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
  it('no toca la base si antes no puede leer el Excel', async () => {
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

  it('calcular aborta si el Excel no tiene la columna ID WEB', async () => {
    const { servicio, graph } = montar({ hoja: [], obras: [], fotos: [] });
    const sinIdWeb = ENCABEZADOS_HOJA.filter((e) => e !== 'ID WEB');
    graph.descargar.and.resolveTo(
      crearXlsxDePrueba({ celdas: sinIdWeb.map((texto, i) => ({ ref: `${columnaALetra(i + 1)}1`, texto })) })
    );

    const error = await servicio.calcular().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorEncabezados);
    expect((error as ErrorEncabezados).faltantes).toEqual(['ID WEB']);
  });

  it('calcular avisa de cada paso con su dato', async () => {
    const { servicio } = montar({
      hoja: [{ TITULO: 'Paisaje', 'ID WEB': 14 }, { TITULO: 'Otra', 'ID WEB': 15 }],
      obras: [obraBase(14, { titulo: 'Paisaje' }), obraBase(15, { titulo: 'Otra' })],
      fotos: [[14, foto({ titulo: 'Paisaje' })]],
    });
    const pasos: [PasoCalculo, string][] = [];

    await servicio.calcular((paso, detalle) => pasos.push([paso, detalle]));

    expect(pasos.map(([paso]) => paso)).toEqual(['descargar', 'encabezados', 'inventario', 'foto', 'comparar']);
    expect(pasos[0][1]).toMatch(/^\d+,\d MB$/);
    expect(pasos.slice(1).map(([, detalle]) => detalle)).toEqual(['16 de 16', '2 obras', '1 foto', '2 filas']);
  });

  it('aplicar no toca nada si al token le queda poco y deja reintentar el mismo cálculo', async () => {
    const { servicio, graph, datos } = montar({
      hoja: [{ TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje', observaciones: 'Nota corregida' })],
      fotos: [[14, foto({ titulo: 'Paisaje', observaciones: 'Nota' })]],
    });
    const calculo = await servicio.calcular();
    graph.minutosRestantes.and.resolveTo(MARGEN_TOKEN_MIN - 5);

    const error = await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorGraph);
    expect((error as ErrorGraph).estado).toBe(401);
    expect(graph.leerRangoUsado).not.toHaveBeenCalled();
    expect(datos.aplicar).not.toHaveBeenCalled();

    graph.minutosRestantes.and.resolveTo(60);
    await expectAsync(servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff))).toBeResolved();
  });
});

describe('SincronizacionService, imágenes de las altas', () => {
  const MEDIOS = {
    'image1.jpeg': new Uint8Array([1]),
    'image2.png': new Uint8Array([2]),
    'image3.gif': new Uint8Array([3]),
    'image4.jpeg': new Uint8Array([4]),
  };
  const celdasImagen = (fila: number, archivos: string[]): CeldaDePrueba[] =>
    archivos.map((imagen, i) => ({ ref: `${columna(`IMAGEN ${i + 1}`)}${fila}`, imagen }));

  function montarAlta() {
    const montaje = montar({
      hoja: [{ AUTOR: 'Ana', TITULO: 'Nueva' }, { TITULO: 'Paisaje', 'ID WEB': 14 }],
      obras: [obraBase(14, { titulo: 'Paisaje' }, [{ id: 80, url: 'https://x/a.jpg' }])],
      fotos: [[14, foto({ titulo: 'Paisaje' })]],
      imagenes: [...celdasImagen(2, ['image2.png', 'image3.gif', 'image1.jpeg']), ...celdasImagen(3, ['image4.jpeg'])],
      medios: MEDIOS,
    });
    montaje.datos.aplicar.and.returnValues(
      Promise.resolve({ aplicados: 0, descartados: [], creadas: [{ fila: 2, obra_id: 700 }] }),
      Promise.resolve(SIN_RESULTADO)
    );
    return montaje;
  }

  it('calcular guarda solo los archivos de las imágenes que se subirán con las altas', async () => {
    const { servicio } = montarAlta();

    const calculo = await servicio.calcular();

    expect(calculo.diff.altasBase[0].imagenes).toEqual([
      { casilla: 1, archivo: 'xl/media/image2.png' },
      { casilla: 3, archivo: 'xl/media/image1.jpeg' },
    ]);
    expect(calculo.diff.altasBase[0].imagenesRechazadas.map((r) => r.casilla)).toEqual([2]);
    expect([...calculo.medios.keys()].sort()).toEqual(['xl/media/image1.jpeg', 'xl/media/image2.png']);
  });

  it('sube las imágenes de cada obra creada en orden de casilla y las registra en su foto', async () => {
    const { servicio, datos } = montarAlta();
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) });

    expect(datos.subirImagen.calls.allArgs()).toEqual([
      [700, 1, 'xl/media/image2.png', MEDIOS['image2.png']],
      [700, 3, 'xl/media/image1.jpeg', MEDIOS['image1.jpeg']],
    ]);
    expect(datos.aplicar.calls.mostRecent().args[0].fotos).toEqual([
      { obra_id: 700, valores: { imagen_1: 901, imagen_2: 902, imagen_3: null } },
    ]);
    expect(resultado.imagenesSubidas).toBe(2);
    expect(resultado.imagenesFallidas).toEqual([]);
  });

  it('no sube imágenes de un alta que no se eligió crear', async () => {
    const { servicio, datos } = montarAlta();
    datos.aplicar.and.resolveTo(SIN_RESULTADO);
    const calculo = await servicio.calcular();

    await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));

    expect(datos.subirImagen).not.toHaveBeenCalled();
  });

  it('si una subida falla sigue con las demás, informa y no impide escribir el ID WEB', async () => {
    const { servicio, datos, graph } = montarAlta();
    datos.subirImagen.and.callFake(async (_obra: number, casilla: number) => {
      if (casilla === 1) throw new Error('Payload too large');
      return 950;
    });
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) });

    expect(graph.escribirValores).toHaveBeenCalledWith('d', 'i', 'Inventario Obras', 'R2:R2', [[700]]);
    expect(resultado.imagenesSubidas).toBe(1);
    expect(resultado.imagenesFallidas).toEqual([{ obraId: 700, fila: 2, casilla: 1, motivo: 'Payload too large' }]);
    expect(datos.aplicar.calls.mostRecent().args[0].fotos).toEqual([
      { obra_id: 700, valores: { imagen_1: 950, imagen_2: null, imagen_3: null } },
    ]);
  });

  it('sube las imágenes aunque Graph falle a mitad de escribir en el Excel', async () => {
    const { servicio, datos, graph } = montarAlta();
    graph.escribirValores.and.rejectWith(new ErrorGraph(401, 'caducado'));
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) });

    expect(resultado.error).toMatch(/caducó/);
    expect(datos.subirImagen).toHaveBeenCalledTimes(2);
  });

  it('con la foto resultante, la siguiente comparación no propone nada sobre esas imágenes', async () => {
    const primera = montarAlta();
    const calculo = await primera.servicio.calcular();
    await primera.servicio.aplicar(calculo, { ...decisionesPorDefecto(calculo.diff), altasBase: new Set([2]) });
    const fotoAlta = primera.datos.aplicar.calls.argsFor(0)[0].altas[0].foto as ValoresFoto;
    const fotoImagenes = primera.datos.aplicar.calls.mostRecent().args[0].fotos[0].valores as ValoresFoto;
    TestBed.resetTestingModule();

    const segunda = montar({
      hoja: [{ AUTOR: 'Ana', TITULO: 'Nueva', 'ID WEB': 700 }],
      obras: [obraBase(700, { autor: 'Ana', titulo: 'Nueva' }, [
        { id: 901, url: `${PREFIJO_BUCKET}sincronizacion/700-1.png` },
        { id: 902, url: `${PREFIJO_BUCKET}sincronizacion/700-3.jpeg` },
      ])],
      fotos: [[700, { ...fotoAlta, ...fotoImagenes }]],
      imagenes: celdasImagen(2, ['image2.png', 'image3.gif', 'image1.jpeg']),
      medios: MEDIOS,
    });
    const siguiente = await segunda.servicio.calcular();

    expect(siguiente.diff.imagenes).toEqual([]);
    expect(siguiente.diff.avisosImagen).toEqual([]);
    expect(siguiente.diff.convergencias).toEqual([]);
    expect(fotoAlta).toEqual(valoresFoto({ ...camposVacios(), autor: 'Ana', titulo: 'Nueva' }, []));
  });
});

describe('SincronizacionService, desde el libro abierto en Excel', () => {
  function montarExcel(opciones: { verificar?: () => Promise<void> } = {}) {
    const filas = [{ TITULO: 'Paisaje', OBSERVACIONES: 'Nota', 'ID WEB': 14 }];
    const acceso: jasmine.SpyObj<AccesoHoja> & { origen: 'excel' } = Object.assign(
      jasmine.createSpyObj<AccesoHoja>('acceso', [
        'conectado', 'nombre', 'verificar', 'descargar', 'leerRangoUsado', 'escribirValores', 'version', 'minutosRestantes',
      ]),
      { origen: 'excel' as const }
    );
    acceso.verificar.and.callFake(opciones.verificar ?? (async () => undefined));
    acceso.descargar.and.resolveTo(xlsx(filas));
    acceso.leerRangoUsado.and.resolveTo(rangoDePrueba(filas));
    acceso.escribirValores.and.resolveTo(undefined);
    acceso.version.and.resolveTo(null);
    acceso.minutosRestantes.and.resolveTo(Number.POSITIVE_INFINITY);
    const datos = {
      hojaVinculada: jasmine.createSpy('hojaVinculada').and.resolveTo({ ...HOJA, url: 'https://upb/Inventario.xlsx' }),
      obras: jasmine.createSpy('obras').and.resolveTo([obraBase(14, { titulo: 'Paisaje', observaciones: 'Nota corregida' })]),
      responsables: jasmine.createSpy('responsables').and.resolveTo([]),
      fotos: jasmine.createSpy('fotos').and.resolveTo(new Map([[14, foto({ titulo: 'Paisaje', observaciones: 'Nota' })]])),
      aplicar: jasmine.createSpy('aplicar').and.resolveTo(SIN_RESULTADO),
      subirImagen: jasmine.createSpy('subirImagen'),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ACCESO_HOJA, useValue: acceso }, { provide: SincronizacionDatosService, useValue: datos }],
    });
    return { servicio: TestBed.inject(SincronizacionService), acceso, datos };
  }

  it('escribe en el libro y, sin eTag, registra igualmente la sincronización con la foto', async () => {
    const { servicio, acceso, datos } = montarExcel();
    const calculo = await servicio.calcular();

    const resultado = await servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff));

    expect(acceso.escribirValores).toHaveBeenCalledOnceWith(calculo.hoja, 'M2:M2', [["'Nota corregida"]]);
    expect(datos.aplicar.calls.mostRecent().args[0]).toEqual({
      campos: [], cargos: [], altas: [],
      fotos: [{ obra_id: 14, valores: { observaciones: 'Nota corregida' } }],
      hoja: { etag: null },
    });
    expect(resultado.error).toBeNull();
  });

  it('no lee nada de un libro que no es el vinculado', async () => {
    const { servicio, acceso, datos } = montarExcel({
      verificar: async () => {
        throw new ErrorLibroDistinto('https://upb/Copia.xlsx', 'https://upb/Inventario.xlsx');
      },
    });

    await expectAsync(servicio.calcular()).toBeRejectedWith(jasmine.any(ErrorLibroDistinto));
    expect(acceso.descargar).not.toHaveBeenCalled();
    expect(datos.obras).not.toHaveBeenCalled();
  });

  it('vuelve a comprobar el libro antes de aplicar y, si cambió, no toca la base', async () => {
    let llamadas = 0;
    const { servicio, datos } = montarExcel({
      verificar: async () => {
        if (llamadas++ > 0) throw new ErrorLibroDistinto('https://upb/Copia.xlsx', 'https://upb/Inventario.xlsx');
      },
    });
    const calculo = await servicio.calcular();

    await expectAsync(servicio.aplicar(calculo, decisionesPorDefecto(calculo.diff))).toBeRejectedWith(jasmine.any(ErrorLibroDistinto));
    expect(datos.aplicar).not.toHaveBeenCalled();
  });
});
