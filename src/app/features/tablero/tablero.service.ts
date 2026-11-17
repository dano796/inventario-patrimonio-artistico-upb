import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { leerPorPaginas } from '../../shared/utils/leer-por-paginas';
import { ObraTablero } from './tablero';

/** ubicacion, valor, bloque_asignado y responsable son restringidas: solo obras_admin las sirve, y solo a administradores. */
const COLUMNAS = 'id, titulo, autor, tecnica, ano, valor, ubicacion, bloque_asignado, responsable, fecha_creacion, imagenes(id)';

export interface FilaTablero {
  id: number;
  titulo: string | null;
  autor: string | null;
  tecnica: string | null;
  ano: number | null;
  valor: number | string | null;
  ubicacion: string | null;
  bloque_asignado: string | null;
  responsable: string | null;
  fecha_creacion: string | null;
  imagenes: { id: number }[] | null;
}

export const obraTableroDesdeFila = (fila: FilaTablero): ObraTablero => ({
  id: Number(fila.id),
  titulo: fila.titulo,
  autor: fila.autor,
  tecnica: fila.tecnica,
  ano: fila.ano === null ? null : Number(fila.ano),
  valor: fila.valor === null ? null : Number(fila.valor),
  ubicacion: fila.ubicacion,
  bloque: fila.bloque_asignado,
  responsable: fila.responsable,
  fechaCreacion: fila.fecha_creacion,
  imagenes: fila.imagenes?.length ?? 0,
});

@Injectable({ providedIn: 'root' })
export class TableroService {
  private supabaseService = inject(SupabaseService);
  private supabaseClient = this.supabaseService.supabaseClient;

  async obras(): Promise<ObraTablero[]> {
    await this.prepareClient();
    const filas = await leerPorPaginas<FilaTablero>((desde, hasta) =>
      this.supabaseClient.from('obras_admin').select(COLUMNAS).order('id').range(desde, hasta)
    );
    return filas.map(obraTableroDesdeFila);
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
