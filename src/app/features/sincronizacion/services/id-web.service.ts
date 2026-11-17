import { Injectable, inject } from '@angular/core';
import { GraphService } from './graph.service';
import { HojaVinculada } from './sincronizacion-datos.service';
import { ENCABEZADO_ID_WEB, ENCABEZADOS } from '../nucleo/hoja-obras';
import {
  AsignacionIdWeb,
  Discrepancia,
  duplicados,
  EstadoFila,
  verificarAsignaciones,
  verificarColumnaVacia,
} from '../nucleo/id-web';
import { claveEmparejamiento, limpiarTexto } from '../nucleo/normalizacion';
import { agruparFilasContiguas, columnaALetra } from '../nucleo/rangos';

export type ResultadoEscritura =
  | { ok: true; escritas: number; yaEscritas: number }
  | { ok: false; discrepancias: Discrepancia[] };

const ANCHO_ENCABEZADO = 'A1:AZ1';

@Injectable({ providedIn: 'root' })
export class IdWebService {
  private graph = inject(GraphService);

  async escribir(
    hoja: HojaVinculada,
    asignaciones: AsignacionIdWeb[],
    progreso: (escritas: number, total: number) => void
  ): Promise<ResultadoEscritura> {
    // Una fila o una obra repetidas en el archivo escribirían dos veces la
    // misma celda: se rechaza sin gastar ninguna petición a Graph.
    const repetidas = duplicados(asignaciones);
    if (repetidas.length) return { ok: false, discrepancias: repetidas };
    if (asignaciones.length === 0) return { ok: true, escritas: 0, yaEscritas: 0 };

    const { drive_id, item_id, nombre_hoja } = hoja;
    const [encabezados = []] = await this.graph.leerValores(drive_id, item_id, nombre_hoja, ANCHO_ENCABEZADO);
    const columnaDe = (nombre: string) => {
      const i = encabezados.findIndex((e) => claveEmparejamiento(e) === claveEmparejamiento(nombre));
      return i === -1 ? null : i + 1;
    };
    const autor = columnaDe(ENCABEZADOS.autor);
    const titulo = columnaDe(ENCABEZADOS.titulo);
    const tecnica = columnaDe(ENCABEZADOS.tecnica);
    const dimension = columnaDe(ENCABEZADOS.dimension);
    if (autor === null || titulo === null || tecnica === null || dimension === null) {
      return {
        ok: false,
        discrepancias: [{ fila: 1, motivo: 'el Excel no tiene las columnas AUTOR, TITULO, TECNICA y DIMENSION (cm)' }],
      };
    }

    // Si «ID WEB» no existe todavía se reclama la primera columna sin
    // encabezado, pero antes hay que leerla: puede tener datos sueltos que no
    // son ID WEB y que una escritura ciega borraría.
    const idWebExistente = columnaDe(ENCABEZADO_ID_WEB);
    const ultimaConTexto = encabezados.reduce<number>((ultima, e, i) => (limpiarTexto(e) === null ? ultima : i + 1), 0);
    const columnaDestino = idWebExistente ?? ultimaConTexto + 1;
    const letra = columnaALetra(columnaDestino);

    const ultimaFila = Math.max(...asignaciones.map((a) => a.fila));
    const leerColumna = async (columna: number) => {
      const letraColumna = columnaALetra(columna);
      return (await this.graph.leerValores(drive_id, item_id, nombre_hoja, `${letraColumna}1:${letraColumna}${ultimaFila}`)).map(
        (f) => f[0]
      );
    };
    const autores = await leerColumna(autor);
    const titulos = await leerColumna(titulo);
    const tecnicas = await leerColumna(tecnica);
    const dimensiones = await leerColumna(dimension);
    const idsDestino = await leerColumna(columnaDestino);

    const actuales = new Map<number, EstadoFila>();
    for (let fila = 2; fila <= ultimaFila; fila++) {
      actuales.set(fila, {
        autor: autores[fila - 1],
        titulo: titulos[fila - 1],
        tecnica: tecnicas[fila - 1],
        dimension: dimensiones[fila - 1],
        idWeb: idsDestino[fila - 1] ?? '',
      });
    }

    if (idWebExistente === null) {
      const ocupadas = verificarColumnaVacia(asignaciones, actuales, letra);
      if (ocupadas.length) return { ok: false, discrepancias: ocupadas };
    }
    // Sin columna «ID WEB» todavía, la celda destino ya se comprobó arriba:
    // para verificarAsignaciones se trata como en blanco, así todas quedan pendientes.
    const paraVerificar =
      idWebExistente === null
        ? new Map([...actuales].map(([fila, e]) => [fila, { ...e, idWeb: '' }] as const))
        : actuales;

    const verificacion = verificarAsignaciones(asignaciones, paraVerificar);
    if (!verificacion.ok) return verificacion;

    if (idWebExistente === null) {
      await this.graph.escribirValores(drive_id, item_id, nombre_hoja, `${letra}1:${letra}1`, [[ENCABEZADO_ID_WEB]]);
    }

    const idDeFila = new Map(verificacion.pendientes.map((a) => [a.fila, a.obraId]));
    let escritas = 0;
    for (const { inicio, fin } of agruparFilasContiguas([...idDeFila.keys()])) {
      const valores: unknown[][] = [];
      for (let fila = inicio; fila <= fin; fila++) valores.push([idDeFila.get(fila)]);
      await this.graph.escribirValores(drive_id, item_id, nombre_hoja, `${letra}${inicio}:${letra}${fin}`, valores);
      escritas += valores.length;
      progreso(escritas, idDeFila.size);
    }
    return { ok: true, escritas, yaEscritas: asignaciones.length - idDeFila.size };
  }
}
