import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Responsable } from '../../../shared/models/responsable.model';
import { buscarPorNombre } from '../utils/buscar-responsables';

const VIOLACION_UNICA = '23505';

@Injectable({ providedIn: 'root' })
export class ResponsablesService {
  private supabaseService = inject(SupabaseService);

  async listar(): Promise<Responsable[]> {
    await this.supabaseService.ensureActiveSession();
    const { data, error } = await this.supabaseService.supabaseClient
      .from('responsables')
      .select('id, nombre, cargo')
      .order('nombre');
    if (error) throw error;
    return data ?? [];
  }

  /** Si ya existe con otras mayúsculas o espacios, el índice único lo rechaza y se devuelve el existente. */
  async crearOReusar(nombre: string, cargo: string | null): Promise<Responsable> {
    await this.supabaseService.ensureActiveSession();
    const { data, error } = await this.supabaseService.supabaseClient
      .from('responsables')
      .insert({ nombre: nombre.trim(), cargo: cargo?.trim() || null })
      .select('id, nombre, cargo')
      .single();
    if (!error) return data;
    if (error.code !== VIOLACION_UNICA) throw error;
    const existente = buscarPorNombre(nombre, await this.listar());
    if (!existente) throw error;
    return existente;
  }
}
