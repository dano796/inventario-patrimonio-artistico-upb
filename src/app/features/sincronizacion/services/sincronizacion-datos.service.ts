import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface HojaVinculada {
  drive_id: string;
  item_id: string;
  nombre_hoja: string;
  fecha_ultima: string | null;
  etag: string | null;
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

  /**
   * Garantiza sesion activa y relee la referencia al cliente, que
   * SupabaseService puede haber sustituido con reinitializeClient().
   */
  private async prepareClient(): Promise<void> {
    await this.supabaseService.ensureActiveSession();
    this.supabaseClient = this.supabaseService.supabaseClient;
  }
}
