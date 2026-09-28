import { TestBed } from '@angular/core/testing';
import { GraphService } from './graph.service';
import { HojaVinculada } from './sincronizacion-datos.service';
import { IdWebService } from './id-web.service';
import { AsignacionIdWeb } from '../nucleo/id-web';
import { letraAColumna } from '../nucleo/rangos';

/**
 * Simula una hoja de Excel en Graph a partir de una matriz de filas (fila 1 =
 * encabezados). Entiende las dos formas de rango que usa IdWebService: la fila
 * de encabezados completa (`A1:AZ1`) y una columna entera (`{letra}1:{letra}N`).
 */
class GraphFalso {
  lecturas: string[] = [];
  escrituras: { direccion: string; valores: unknown[][] }[] = [];

  constructor(private filas: unknown[][]) {}

  async leerValores(_d: string, _i: string, _h: string, direccion: string): Promise<unknown[][]> {
    this.lecturas.push(direccion);
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(direccion);
    if (!m) throw new Error(`dirección no soportada por el falso: ${direccion}`);
    const colDesde = letraAColumna(m[1]);
    const filaDesde = Number(m[2]);
    const colHasta = letraAColumna(m[3]);
    const filaHasta = Number(m[4]);
    const resultado: unknown[][] = [];
    for (let f = filaDesde; f <= filaHasta; f++) {
      const fila: unknown[] = [];
      for (let c = colDesde; c <= colHasta; c++) fila.push(this.filas[f - 1]?.[c - 1] ?? null);
      resultado.push(fila);
    }
    return resultado;
  }

  async escribirValores(_d: string, _i: string, _h: string, direccion: string, valores: unknown[][]): Promise<void> {
    this.escrituras.push({ direccion, valores });
  }
}

const HOJA: HojaVinculada = {
  drive_id: 'drive-1', item_id: 'item-1', nombre_hoja: 'Inventario Obras', fecha_ultima: null, etag: 'etag-1',
};

function crearServicio(filas: unknown[][]): { servicio: IdWebService; graph: GraphFalso } {
  const graph = new GraphFalso(filas);
  TestBed.configureTestingModule({ providers: [{ provide: GraphService, useValue: graph }] });
  return { servicio: TestBed.inject(IdWebService), graph };
}

const asignacion = (
  fila: number, obraId: number, autor: string, titulo: string, tecnica = 'Oleo', dimension = '30x40'
): AsignacionIdWeb => ({ fila, obraId, autor, titulo, tecnica, dimension });

describe('IdWebService.escribir', () => {
  it('sin columna «ID WEB»: si la primera columna libre ya tiene un valor, avisa y no escribe nada', async () => {
    const filas = [
      ['AUTOR', 'TITULO', 'TECNICA', 'DIMENSION (cm)', 'ALGO'],
      ['Autor A', 'Titulo A', 'Oleo', '30x40', null, null],
      ['Autor B', 'Titulo B', 'Oleo', '30x40', null, 'restos'],
    ];
    const { servicio, graph } = crearServicio(filas);
    const asignaciones = [
      asignacion(2, 10, 'Autor A', 'Titulo A'),
      asignacion(3, 11, 'Autor B', 'Titulo B'),
    ];

    const resultado = await servicio.escribir(HOJA, asignaciones, () => {});

    expect(resultado).toEqual({ ok: false, discrepancias: [{ fila: 3, motivo: 'la columna F ya tiene un valor en la fila 3' }] });
    expect(graph.escrituras).toEqual([]);
  });

  it('una fila que ya tiene su ID no se reescribe y cuenta como yaEscritas', async () => {
    const filas = [
      ['AUTOR', 'TITULO', 'TECNICA', 'DIMENSION (cm)', 'ID WEB'],
      ['Autor A', 'Titulo A', 'Oleo', '30x40', 10],
      ['Autor B', 'Titulo B', 'Oleo', '30x40', null],
    ];
    const { servicio, graph } = crearServicio(filas);
    const asignaciones = [
      asignacion(2, 10, 'Autor A', 'Titulo A'),
      asignacion(3, 11, 'Autor B', 'Titulo B'),
    ];

    const resultado = await servicio.escribir(HOJA, asignaciones, () => {});

    expect(resultado).toEqual({ ok: true, escritas: 1, yaEscritas: 1 });
    expect(graph.escrituras).toEqual([{ direccion: "E3:E3", valores: [[11]] }]);
  });

  it('una fila con un ID distinto del esperado se detiene y no escribe nada', async () => {
    const filas = [
      ['AUTOR', 'TITULO', 'TECNICA', 'DIMENSION (cm)', 'ID WEB'],
      ['Autor A', 'Titulo A', 'Oleo', '30x40', 999],
    ];
    const { servicio, graph } = crearServicio(filas);
    const asignaciones = [asignacion(2, 10, 'Autor A', 'Titulo A')];

    const resultado = await servicio.escribir(HOJA, asignaciones, () => {});

    expect(resultado).toEqual({ ok: false, discrepancias: [{ fila: 2, motivo: 'ya tiene el ID WEB 999, se esperaba 10' }] });
    expect(graph.escrituras).toEqual([]);
  });

  it('escribe por bloques contiguos, saltando las filas que ya estaban escritas', async () => {
    const filas = [
      ['AUTOR', 'TITULO', 'TECNICA', 'DIMENSION (cm)', 'ID WEB'],
      ['A2', 'T2', 'Oleo', '30x40', null],
      ['A3', 'T3', 'Oleo', '30x40', 903],
      ['A4', 'T4', 'Oleo', '30x40', null],
      ['A5', 'T5', 'Oleo', '30x40', null],
    ];
    const { servicio, graph } = crearServicio(filas);
    const asignaciones = [
      asignacion(2, 901, 'A2', 'T2'),
      asignacion(3, 903, 'A3', 'T3'),
      asignacion(4, 904, 'A4', 'T4'),
      asignacion(5, 905, 'A5', 'T5'),
    ];
    const progresos: { escritas: number; total: number }[] = [];

    const resultado = await servicio.escribir(HOJA, asignaciones, (escritas, total) => progresos.push({ escritas, total }));

    expect(resultado).toEqual({ ok: true, escritas: 3, yaEscritas: 1 });
    expect(graph.escrituras).toEqual([
      { direccion: 'E2:E2', valores: [[901]] },
      { direccion: 'E4:E5', valores: [[904], [905]] },
    ]);
    expect(progresos).toEqual([
      { escritas: 1, total: 3 },
      { escritas: 3, total: 3 },
    ]);
  });
});
