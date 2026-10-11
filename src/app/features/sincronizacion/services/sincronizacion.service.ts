import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { ErrorGraph, GraphService } from './graph.service';
import { HojaVinculada, ResultadoRpc, SincronizacionDatosService } from './sincronizacion-datos.service';
import { descomprimirXlsx, leerHoja } from '../nucleo/leer-xlsx';
import { leerFilasObras, ResultadoHoja } from '../nucleo/hoja-obras';
import { ObraBase } from '../nucleo/importacion';
import { ValoresFoto } from '../nucleo/foto';
import { Diff } from '../nucleo/diff-tipos';
import { calcularDiff } from '../nucleo/diff';
import { Decisiones, planificarEjecucion } from '../nucleo/plan-ejecucion';
import {
  agruparEnBloques, bloqueDeAltas, columnasDeEncabezados, Descartada, lecturaDesdeRango, origenDeDireccion,
  ubicarEscrituras, ubicarIdsNuevos,
} from '../nucleo/verificar-hoja';

export const PREFIJO_BUCKET = `${environment.SUPABASE_URL}/storage/v1/object/public/imagenes-obras/`;

export interface Calculo {
  hoja: HojaVinculada;
  lectura: ResultadoHoja;
  obras: ObraBase[];
  diff: Diff;
}

export interface ResultadoAplicacion {
  base: ResultadoRpc;
  escritasEnHoja: number;
  altasEnHoja: number;
  descartadasEnHoja: Descartada[];
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SincronizacionService {
  private graph = inject(GraphService);
  private datos = inject(SincronizacionDatosService);

  /** Nada se escribe aquí: el diff se revisa antes de aplicar. */
  async calcular(): Promise<Calculo> {
    const hoja = await this.datos.hojaVinculada();
    if (!hoja) throw new Error('No hay ninguna hoja vinculada. Vincúlala antes de sincronizar.');
    const contenido = await this.graph.descargar(hoja.drive_id, hoja.item_id);
    const lectura = leerFilasObras(leerHoja(descomprimirXlsx(contenido), hoja.nombre_hoja, new DOMParser()));
    const [obras, responsables, fotos] = await Promise.all([
      this.datos.obras(),
      this.datos.responsables(),
      this.datos.fotos(),
    ]);
    const diff = calcularDiff({ lectura, obras, responsables, fotos, prefijoBucket: PREFIJO_BUCKET });
    return { hoja, lectura, obras, diff };
  }

  /**
   * Primero la base, en una transacción; después la hoja, rango a rango. La foto
   * de lo escrito en la hoja se registra al final y solo de lo que se escribió:
   * si Graph falla a medias, lo que falta reaparece en la siguiente ejecución.
   */
  async aplicar(calculo: Calculo, decisiones: Decisiones): Promise<ResultadoAplicacion> {
    const filas = new Map(calculo.lectura.filas.map((f) => [f.fila, f]));
    const plan = planificarEjecucion(calculo.diff, decisiones, {
      obras: new Map(calculo.obras.map((o) => [o.id, o])),
      filas,
      prefijoBucket: PREFIJO_BUCKET,
    });
    const base = await this.datos.aplicar(plan.peticion);

    const { drive_id, item_id, nombre_hoja } = calculo.hoja;
    const rango = await this.graph.leerRangoUsado(drive_id, item_id, nombre_hoja);
    const origen = origenDeDireccion(rango.address);
    const columnas = columnasDeEncabezados(rango.values[1 - origen.fila] ?? []);
    if ('faltantes' in columnas) throw new Error(`Faltan encabezados en la hoja: ${columnas.faltantes.join(', ')}`);
    const lectura = lecturaDesdeRango(rango.values, rango.formulas, columnas.idWeb, origen);

    const ids = ubicarIdsNuevos(
      base.creadas.map((c) => ({ fila: c.fila, obraId: c.obra_id, campos: filas.get(c.fila)!.campos })),
      lectura,
      columnas
    );
    const campos = ubicarEscrituras(plan.escrituras, lectura, columnas);
    const resultado: ResultadoAplicacion = {
      base, escritasEnHoja: 0, altasEnHoja: 0, descartadasEnHoja: [...ids.descartadas, ...campos.descartadas], error: null,
    };

    const fotos = new Map<number, ValoresFoto>();
    const anotar = (obraId: number, foto: ValoresFoto) => {
      if (Object.keys(foto).length) fotos.set(obraId, { ...fotos.get(obraId), ...foto });
    };
    try {
      for (const bloque of agruparEnBloques([...ids.ubicadas, ...campos.ubicadas])) {
        await this.graph.escribirValores(drive_id, item_id, nombre_hoja, bloque.direccion, bloque.valores);
        for (const e of bloque.escrituras) anotar(e.obraId, e.foto);
        resultado.escritasEnHoja += bloque.escrituras.length;
      }
      const altas = bloqueDeAltas(plan.altasHoja, lectura.ultimaFila + 1, columnas);
      if (altas) {
        await this.graph.escribirValores(drive_id, item_id, nombre_hoja, altas.direccion, altas.valores);
        for (const alta of altas.altas) anotar(alta.obraId, alta.foto);
        resultado.altasEnHoja = altas.altas.length;
      }
    } catch (e) {
      resultado.error =
        e instanceof ErrorGraph && e.estado === 401
          ? 'La conexión con OneDrive caducó. Conecta de nuevo y vuelve a sincronizar: lo que falta reaparecerá.'
          : e instanceof Error
            ? e.message
            : 'No se pudo terminar de escribir en la hoja.';
    }

    const etag = resultado.error === null ? (await this.graph.archivo(drive_id, item_id)).eTag : null;
    if (fotos.size || etag) {
      await this.datos.aplicar({
        campos: [], cargos: [], altas: [],
        fotos: [...fotos].map(([obra_id, valores]) => ({ obra_id, valores })),
        ...(etag ? { hoja: { etag } } : {}),
      });
    }
    return resultado;
  }
}
