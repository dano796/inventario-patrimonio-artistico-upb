import { TestBed } from '@angular/core/testing';
import { AccesoHojaExcel } from './acceso-hoja-excel';
import { ApiOffice, ArchivoOffice, ContextoExcel, OfficeService, RangoExcel } from './office.service';
import { ErrorLibroDistinto } from '../../sincronizacion/services/acceso-hoja';
import { HojaVinculada } from '../../sincronizacion/services/sincronizacion-datos.service';

const URL_LIBRO = 'https://upbeduco-my.sharepoint.com/personal/t/Documents/Inventario/Inventario%20Patrimonio%20UPB%201.xlsx';
const HOJA: HojaVinculada = {
  drive_id: 'd', item_id: 'i', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: null, url: URL_LIBRO,
};
const OK = 'succeeded';
const fallo = (message: string) => ({ status: 'failed', value: undefined as never, error: { code: 1, message } });

function crear(opciones: { trozos?: number[][]; falloEnTrozo?: number; falloArchivo?: string } = {}) {
  const trozos = opciones.trozos ?? [[0x50, 0x4b, 1], [2, 3]];
  const closeAsync = jasmine.createSpy('closeAsync');
  const archivo: ArchivoOffice = {
    size: trozos.flat().length,
    sliceCount: trozos.length,
    getSliceAsync: (i, retorno) =>
      retorno(i === opciones.falloEnTrozo ? fallo('trozo perdido') : { status: OK, value: { data: trozos[i] }, error: null as never }),
    closeAsync,
  };
  const rango: RangoExcel & { cargado?: string } = {
    address: "'Inventario Obras'!A1:T562", values: [['TITULO']], formulas: [['TITULO']],
    load(propiedades) { this.cargado = propiedades; },
  };
  const escrito: RangoExcel = { address: '', values: [], formulas: [], load: () => undefined };
  const getItem = jasmine.createSpy('getItem').and.returnValue({
    getUsedRange: () => rango,
    getRange: jasmine.createSpy('getRange').and.returnValue(escrito),
  });
  const sync = jasmine.createSpy('sync').and.resolveTo(undefined);
  const contexto: ContextoExcel = { workbook: { worksheets: { getItem } }, sync };
  const api = {
    Excel: { run: (lote: (c: ContextoExcel) => Promise<unknown>) => lote(contexto) },
    Office: {
      context: {
        document: {
          url: URL_LIBRO,
          getFileAsync: jasmine.createSpy('getFileAsync').and.callFake((_tipo, _opciones, retorno) =>
            retorno(opciones.falloArchivo ? fallo(opciones.falloArchivo) : { status: OK, value: archivo, error: null as never })
          ),
        },
      },
      FileType: { Compressed: 'compressed' },
      AsyncResultStatus: { Succeeded: OK },
    },
  } as unknown as ApiOffice;
  TestBed.configureTestingModule({ providers: [AccesoHojaExcel, { provide: OfficeService, useValue: { api: () => api } }] });
  return { acceso: TestBed.inject(AccesoHojaExcel), api, rango, escrito, getItem, sync, closeAsync };
}

describe('AccesoHojaExcel', () => {
  it('descarga el libro abierto uniendo sus trozos y cierra el archivo', async () => {
    const { acceso, api, closeAsync } = crear();

    const datos = await acceso.descargar();

    expect(Array.from(datos)).toEqual([0x50, 0x4b, 1, 2, 3]);
    expect(api.Office.context.document.getFileAsync).toHaveBeenCalledWith('compressed', { sliceSize: 4 * 1024 * 1024 }, jasmine.any(Function));
    expect(closeAsync).toHaveBeenCalledTimes(1);
  });

  it('si falla un trozo rechaza y cierra el archivo, que Office no deja abrir dos veces', async () => {
    const { acceso, closeAsync } = crear({ falloEnTrozo: 1 });
    await expectAsync(acceso.descargar()).toBeRejectedWithError(/trozo perdido/);
    expect(closeAsync).toHaveBeenCalledTimes(1);
  });

  it('si Excel no entrega el libro rechaza con su motivo', async () => {
    const { acceso } = crear({ falloArchivo: 'sin permiso' });
    await expectAsync(acceso.descargar()).toBeRejectedWithError(/sin permiso/);
  });

  it('lee el rango usado de la hoja vinculada con valores y fórmulas, como Graph', async () => {
    const { acceso, getItem, rango } = crear();

    expect(await acceso.leerRangoUsado(HOJA)).toEqual({
      address: "'Inventario Obras'!A1:T562", values: [['TITULO']], formulas: [['TITULO']],
    });
    expect(getItem).toHaveBeenCalledWith('Inventario Obras');
    expect((rango as { cargado?: string }).cargado).toBe('address,values,formulas');
  });

  it('escribe los valores en el rango pedido y sincroniza', async () => {
    const { acceso, getItem, escrito, sync } = crear();
    const valores = [[721], [null], ['=IMAGE("https://x/a.jpg")']];

    await acceso.escribirValores(HOJA, 'S540:S542', valores);

    expect(getItem.calls.mostRecent().returnValue.getRange).toHaveBeenCalledWith('S540:S542');
    expect(escrito.values).toEqual(valores);
    expect(sync).toHaveBeenCalled();
  });

  it('solo acepta el libro cuya URL es la vinculada', async () => {
    const { acceso } = crear();

    await expectAsync(acceso.verificar(HOJA)).toBeResolved();
    await expectAsync(acceso.verificar({ ...HOJA, url: null })).toBeRejectedWith(jasmine.any(ErrorLibroDistinto));
    const otro = await acceso.verificar({ ...HOJA, url: `${URL_LIBRO}x` }).catch((e: ErrorLibroDistinto) => e);
    expect(otro).toEqual(jasmine.objectContaining({ abierto: URL_LIBRO, vinculado: `${URL_LIBRO}x` }));
  });

  it('da el nombre del libro abierto sin codificar, sin eTag y sin caducidad', async () => {
    const { acceso } = crear();
    expect(await acceso.nombre()).toBe('Inventario Patrimonio UPB 1.xlsx');
    expect(await acceso.version()).toBeNull();
    expect(await acceso.minutosRestantes()).toBe(Number.POSITIVE_INFINITY);
    expect(await acceso.conectado()).toBeTrue();
  });
});
