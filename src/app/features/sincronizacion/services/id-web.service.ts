import { Injectable, inject } from '@angular/core';
import { GraphService } from './graph.service';
import { HojaVinculada } from './sincronizacion-datos.service';
import { ENCABEZADO_ID_WEB, ENCABEZADOS } from '../nucleo/hoja-obras';
import { AsignacionIdWeb, Discrepancia, EstadoFila, verificarAsignaciones } from '../nucleo/id-web';
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
    const { drive_id, item_id, nombre_hoja } = hoja;
    const [encabezados = []] = await this.graph.leerValores(drive_id, item_id, nombre_hoja, ANCHO_ENCABEZADO);
    const columnaDe = (nombre: string) => {
      const i = encabezados.findIndex((e) => claveEmparejamiento(e) === claveEmparejamiento(nombre));
      return i === -1 ? null : i + 1;
    };
    const autor = columnaDe(ENCABEZADOS.autor);
    const titulo = columnaDe(ENCABEZADOS.titulo);
    if (autor === null || titulo === null) {
      return { ok: false, discrepancias: [{ fila: 1, motivo: 'la hoja no tiene las columnas AUTOR y TITULO' }] };
    }
    let idWeb = columnaDe(ENCABEZADO_ID_WEB);
    const ultimaFila = Math.max(...asignaciones.map((a) => a.fila));
    const leerColumna = async (columna: number) => {
      const letra = columnaALetra(columna);
      return (await this.graph.leerValores(drive_id, item_id, nombre_hoja, `${letra}1:${letra}${ultimaFila}`)).map((f) => f[0]);
    };
    const autores = await leerColumna(autor);
    const titulos = await leerColumna(titulo);
    const ids = idWeb === null ? [] : await leerColumna(idWeb);
    const actuales = new Map<number, EstadoFila>();
    for (let fila = 2; fila <= ultimaFila; fila++) {
      actuales.set(fila, { autor: autores[fila - 1], titulo: titulos[fila - 1], idWeb: ids[fila - 1] ?? '' });
    }

    const verificacion = verificarAsignaciones(asignaciones, actuales);
    if (!verificacion.ok) return verificacion;

    if (idWeb === null) {
      const ultimaConTexto = encabezados.reduce<number>((ultima, e, i) => (limpiarTexto(e) === null ? ultima : i + 1), 0);
      idWeb = ultimaConTexto + 1;
      const celda = `${columnaALetra(idWeb)}1`;
      await this.graph.escribirValores(drive_id, item_id, nombre_hoja, `${celda}:${celda}`, [[ENCABEZADO_ID_WEB]]);
    }

    const letra = columnaALetra(idWeb);
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
