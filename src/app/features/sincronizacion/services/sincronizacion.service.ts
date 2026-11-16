import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { ErrorGraph } from './graph.service';
import { ACCESO_HOJA } from './acceso-hoja';
import { HojaVinculada, ResultadoRpc, SincronizacionDatosService } from './sincronizacion-datos.service';
import { abrirXlsx, extraerMedios, leerHoja } from '../nucleo/leer-xlsx';
import {
  CAMPOS, ENCABEZADO_ID_WEB, ENCABEZADOS_IMAGEN, ErrorEncabezados, leerFilasObras, mensajeEncabezados, ResultadoHoja,
} from '../nucleo/hoja-obras';
import { ObraBase } from '../nucleo/importacion';
import { CASILLAS_IMAGEN, claveImagen, ValoresFoto } from '../nucleo/foto';
import { Diff } from '../nucleo/diff-tipos';
import { calcularDiff } from '../nucleo/diff';
import { Decisiones, planificarEjecucion } from '../nucleo/plan-ejecucion';
import {
  agruparEnBloques, bloqueDeAltas, columnasDeEncabezados, Descartada, lecturaDesdeRango, origenDeDireccion,
  ubicarEscrituras, ubicarIdsNuevos,
} from '../nucleo/verificar-hoja';

export const PREFIJO_BUCKET = `${environment.SUPABASE_URL}/storage/v1/object/public/imagenes-obras/`;

export type PasoCalculo = 'descargar' | 'encabezados' | 'inventario' | 'foto' | 'comparar';
export type AvisoProgreso = (paso: PasoCalculo, detalle: string) => void;

/** Margen para que el token no caduque entre la prelectura de la hoja y las escrituras. */
export const MARGEN_TOKEN_MIN = 10;

const TOTAL_ENCABEZADOS = CAMPOS.length + ENCABEZADOS_IMAGEN.length + 1;
const plural = (n: number, palabra: string) => `${n.toLocaleString('es-CO')} ${palabra}${n === 1 ? '' : 's'}`;

export interface Calculo {
  hoja: HojaVinculada;
  lectura: ResultadoHoja;
  obras: ObraBase[];
  diff: Diff;
  medios: ReadonlyMap<string, Uint8Array>;
}

export interface ImagenFallida {
  obraId: number;
  fila: number;
  casilla: number;
  motivo: string;
}

export interface ResultadoAplicacion {
  base: ResultadoRpc;
  escritasEnHoja: number;
  altasEnHoja: number;
  descartadasEnHoja: Descartada[];
  imagenesSubidas: number;
  imagenesFallidas: ImagenFallida[];
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SincronizacionService {
  private acceso = inject(ACCESO_HOJA);
  private datos = inject(SincronizacionDatosService);
  /** Las altas no son idempotentes: reintentar con el mismo cálculo duplicaría obras. */
  private gastados = new WeakSet<Calculo>();

  /** Nada se escribe aquí: el diff se revisa antes de aplicar. */
  async calcular(progreso: AvisoProgreso = () => undefined): Promise<Calculo> {
    const hoja = await this.datos.hojaVinculada();
    if (!hoja) throw new Error('No hay ninguna hoja vinculada. Vincúlala antes de sincronizar.');
    await this.acceso.verificar(hoja);
    const contenido = await this.acceso.descargar(hoja);
    progreso('descargar', `${(contenido.byteLength / 1024 / 1024).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`);
    const { archivos, tamanos } = abrirXlsx(contenido);
    const lectura = leerFilasObras(leerHoja(archivos, hoja.nombre_hoja, new DOMParser()));
    if (lectura.columnaIdWeb === null) throw new ErrorEncabezados([ENCABEZADO_ID_WEB]);
    progreso('encabezados', `${TOTAL_ENCABEZADOS} de ${TOTAL_ENCABEZADOS}`);
    const [obras, responsables, fotos] = await Promise.all([
      this.datos.obras(),
      this.datos.responsables(),
      this.datos.fotos(),
    ]);
    progreso('inventario', plural(obras.length, 'obra'));
    progreso('foto', plural(fotos.size, 'foto'));
    const diff = calcularDiff({ lectura, obras, responsables, fotos, prefijoBucket: PREFIJO_BUCKET, tamanos });
    const medios = extraerMedios(contenido, new Set(diff.altasBase.flatMap((a) => a.imagenes.map((i) => i.archivo))));
    progreso('comparar', plural(lectura.filas.length, 'fila'));
    return { hoja, lectura, obras, diff, medios };
  }

  /**
   * Primero se comprueba que la hoja se puede leer, porque lo que se confirme en
   * la base ya no se deshace; después la base, en una transacción; después la
   * hoja, rango a rango, empezando por el ID WEB de las obras nuevas. La foto de
   * lo escrito en la hoja se registra al final y solo de lo que se escribió: si
   * la escritura falla a medias, lo que falta reaparece en la siguiente ejecución.
   * Las imágenes pegadas de las altas se suben después del ID WEB, que es lo
   * que impide que la siguiente ejecución vuelva a proponer el alta.
   */
  async aplicar(calculo: Calculo, decisiones: Decisiones): Promise<ResultadoAplicacion> {
    if ((await this.acceso.minutosRestantes()) < MARGEN_TOKEN_MIN) {
      throw new ErrorGraph(401, 'La conexión con OneDrive está a punto de caducar. Reconecta antes de aplicar.');
    }
    if (this.gastados.has(calculo)) {
      throw new Error('Este cálculo ya se aplicó o se intentó aplicar. Vuelve a calcular antes de reintentar.');
    }
    this.gastados.add(calculo);
    const filas = new Map(calculo.lectura.filas.map((f) => [f.fila, f]));
    const plan = planificarEjecucion(calculo.diff, decisiones, {
      obras: new Map(calculo.obras.map((o) => [o.id, o])),
      filas,
      prefijoBucket: PREFIJO_BUCKET,
    });

    const { hoja } = calculo;
    await this.acceso.verificar(hoja);
    const rango = await this.acceso.leerRangoUsado(hoja);
    const origen = origenDeDireccion(rango.address);
    const columnas = columnasDeEncabezados(rango.values[1 - origen.fila] ?? []);
    if ('faltantes' in columnas) throw new Error(mensajeEncabezados(columnas.faltantes, columnas.repetidos));
    const lectura = lecturaDesdeRango(rango.values, rango.formulas, columnas.idWeb, origen);

    const base = await this.datos.aplicar(plan.peticion);

    const ids = ubicarIdsNuevos(
      base.creadas.map((c) => {
        const { campos, heredados, noConvertibles } = filas.get(c.fila)!;
        return { fila: c.fila, obraId: c.obra_id, campos, heredados, noConvertibles };
      }),
      lectura,
      columnas
    );
    const campos = ubicarEscrituras(plan.escrituras, lectura, columnas);
    const resultado: ResultadoAplicacion = {
      base, escritasEnHoja: 0, altasEnHoja: 0, descartadasEnHoja: [...ids.descartadas, ...campos.descartadas],
      imagenesSubidas: 0, imagenesFallidas: [], error: null,
    };

    const fotos = new Map<number, ValoresFoto>();
    const anotar = (obraId: number, foto: ValoresFoto) => {
      if (Object.keys(foto).length) fotos.set(obraId, { ...fotos.get(obraId), ...foto });
    };
    try {
      for (const bloque of [...agruparEnBloques(ids.ubicadas), ...agruparEnBloques(campos.ubicadas)]) {
        await this.acceso.escribirValores(hoja, bloque.direccion, bloque.valores);
        for (const e of bloque.escrituras) anotar(e.obraId, e.foto);
        resultado.escritasEnHoja += bloque.escrituras.length;
      }
      const altas = bloqueDeAltas(plan.altasHoja, lectura.ultimaFila + 1, columnas);
      if (altas) {
        await this.acceso.escribirValores(hoja, altas.direccion, altas.valores);
        for (const alta of altas.altas) anotar(alta.obraId, alta.foto);
        resultado.altasEnHoja = altas.altas.length;
      }
    } catch (e) {
      resultado.error = mensajeDeError(e);
    }

    for (const creada of base.creadas) {
      const ids = await this.subirImagenesDeAlta(calculo, creada.fila, creada.obra_id, resultado);
      if (ids.length) {
        const foto: ValoresFoto = {};
        for (let i = 0; i < CASILLAS_IMAGEN; i++) foto[claveImagen(i + 1)] = ids[i] ?? null;
        anotar(creada.obra_id, foto);
      }
    }

    let etag: string | null = null;
    if (resultado.error === null) {
      try {
        etag = await this.acceso.version(hoja);
      } catch (e) {
        resultado.error = mensajeDeError(e);
      }
    }
    const completa = resultado.error === null;
    if (fotos.size || completa) {
      await this.datos.aplicar({
        campos: [], cargos: [], altas: [],
        fotos: [...fotos].map(([obra_id, valores]) => ({ obra_id, valores })),
        ...(completa ? { hoja: { etag } } : {}),
      });
    }
    return resultado;
  }

  /** En orden de casilla: la casilla de cada imagen en la base sale del orden de sus ids. */
  private async subirImagenesDeAlta(calculo: Calculo, fila: number, obraId: number, resultado: ResultadoAplicacion): Promise<number[]> {
    const alta = calculo.diff.altasBase.find((a) => a.fila === fila);
    const ids: number[] = [];
    for (const { casilla, archivo } of [...(alta?.imagenes ?? [])].sort((a, b) => a.casilla - b.casilla)) {
      const fallar = (motivo: string) => resultado.imagenesFallidas.push({ obraId, fila, casilla, motivo });
      const datos = calculo.medios.get(archivo);
      if (!datos) {
        fallar('no se encontró la imagen en el archivo descargado');
        continue;
      }
      try {
        ids.push(await this.datos.subirImagen(obraId, casilla, archivo, datos));
        resultado.imagenesSubidas++;
      } catch (e) {
        fallar((e as { message?: string } | null)?.message || 'no se pudo subir la imagen');
      }
    }
    return ids;
  }
}

function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorGraph && e.estado === 401) {
    return 'La conexión con OneDrive caducó. Conecta de nuevo y vuelve a sincronizar: lo que falta reaparecerá.';
  }
  return e instanceof Error ? e.message : 'No se pudo terminar de escribir en la hoja.';
}
