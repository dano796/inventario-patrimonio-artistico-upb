import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ObraBase } from '../nucleo/importacion';
import { ResponsableBase } from '../nucleo/diff-tipos';
import { ValoresFoto } from '../nucleo/foto';
import { PeticionSincronizacion } from '../nucleo/plan-ejecucion';

export interface HojaVinculada {
  drive_id: string;
  item_id: string;
  nombre_hoja: string;
  fecha_ultima: string | null;
  etag: string | null;
}

export interface ResultadoRpc {
  aplicados: number;
  descartados: { obra_id?: number; campo?: string; clave?: string; motivo: string }[];
  creadas: { fila: number; obra_id: number }[];
}

const COLUMNAS_OBRA =
  'id, autor, titulo, tecnica, dimension, ano, ubicacion, bloque_asignado, valor, descripcion, responsable, cargo, observaciones, imagenes(id, url)';
const PAGINA = 1000;

/** PostgREST corta cada respuesta en max-rows: se pide por páginas hasta que una llega vacía. */
export async function leerPorPaginas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; ) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    if (!data?.length) return filas;
    filas.push(...data);
    desde += data.length;
  }
}

export function obraDesdeFila(fila: Record<string, unknown>): ObraBase {
  const texto = (columna: string) => (fila[columna] ?? null) as string | null;
  const numero = (columna: string) => (fila[columna] === null || fila[columna] === undefined ? null : Number(fila[columna]));
  const imagenes = (fila['imagenes'] ?? []) as { id: number; url: string }[];
  return {
    id: Number(fila['id']),
    campos: {
      autor: texto('autor'), titulo: texto('titulo'), tecnica: texto('tecnica'), dimension: texto('dimension'),
      ano: numero('ano'), ubicacion: texto('ubicacion'), bloque_asignado: texto('bloque_asignado'), valor: numero('valor'),
      descripcion: texto('descripcion'), responsable: texto('responsable'), cargo: texto('cargo'),
      observaciones: texto('observaciones'),
    },
    imagenes: imagenes.map((i) => ({ id: Number(i.id), url: i.url })),
  };
}

@Injectable({ providedIn: 'root' })
export class SincronizacionDatosService {
  private supabaseService = inject(SupabaseService);
  private supabaseClient = this.supabaseService.supabaseClient;

  async hojaVinculada(): Promise<HojaVinculada | null> {
    await this.prepareClient();
    const { data, error } = await this.supabaseClient
      .from('sincronizacion_hoja')
      .select('drive_id, item_id, nombre_hoja, fecha_ultima, etag')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async vincular(hoja: Omit<HojaVinculada, 'fecha_ultima'>): Promise<void> {
    await this.prepareClient();
    const { error } = await this.supabaseClient
      .from('sincronizacion_hoja')
      .upsert({ id: 1, ...hoja })
      .select('id');
    if (error) throw error;
  }

  async obras(): Promise<ObraBase[]> {
    await this.prepareClient();
    const filas = await leerPorPaginas<Record<string, unknown>>((desde, hasta) =>
      this.supabaseClient.from('obras_admin').select(COLUMNAS_OBRA).order('id').range(desde, hasta)
    );
    return filas.map(obraDesdeFila);
  }

  async responsables(): Promise<ResponsableBase[]> {
    await this.prepareClient();
    return leerPorPaginas<ResponsableBase>((desde, hasta) =>
      this.supabaseClient.from('responsables').select('id, nombre, cargo').order('id').range(desde, hasta)
    );
  }

  async fotos(): Promise<Map<number, ValoresFoto>> {
    await this.prepareClient();
    const filas = await leerPorPaginas<{ obra_id: number; valores: ValoresFoto }>((desde, hasta) =>
      this.supabaseClient.from('sincronizacion_estado').select('obra_id, valores').order('obra_id').range(desde, hasta)
    );
    return new Map(filas.map((f) => [Number(f.obra_id), f.valores]));
  }

  async aplicar(peticion: PeticionSincronizacion): Promise<ResultadoRpc> {
    await this.prepareClient();
    const { data, error } = await this.supabaseClient.rpc('aplicar_sincronizacion', { peticion });
    if (error) throw error;
    return data as ResultadoRpc;
  }

  /**
   * Garantiza sesion activa y relee la referencia al cliente, que
   * SupabaseService puede haber sustituido con reinitializeClient().
   */
  private async prepareClient(): Promise<void> {
    await this.supabaseService.ensureActiveSession();
    this.supabaseClient = this.supabaseService.supabaseClient;
  }
}
