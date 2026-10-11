import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { leerPorPaginas } from '../../shared/utils/leer-por-paginas';
import { ObraTablero } from './tablero';

/** ubicacion y responsable son restringidas: solo obras_admin las sirve, y solo a administradores. */
const COLUMNAS = 'id, titulo, autor, tecnica, ubicacion, responsable, fecha_creacion, imagenes(id)';

export interface FilaTablero {
  id: number;
  titulo: string | null;
  autor: string | null;
  tecnica: string | null;
  ubicacion: string | null;
  responsable: string | null;
  fecha_creacion: string | null;
  imagenes: { id: number }[] | null;
}

export const obraTableroDesdeFila = (fila: FilaTablero): ObraTablero => ({
  id: Number(fila.id),
  titulo: fila.titulo,
  autor: fila.autor,
  tecnica: fila.tecnica,
  ubicacion: fila.ubicacion,
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
