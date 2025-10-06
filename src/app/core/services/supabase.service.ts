import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from './../../../environments/environment.development';
import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService implements OnDestroy {
  supabaseClient: SupabaseClient;
  private heartbeatInterval: any = null;
  private readonly HEARTBEAT_INTERVAL = 50 * 1000; // 50 segundos (antes de que expire)

  constructor() {
    this.supabaseClient = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'X-Client-Info': 'supabase-js-web',
          },
        },
        // Configuración más agresiva para mantener conexión
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );

    // Configurar listener para detectar cambios de sesión
    this.setupSessionMonitoring();

    // Iniciar heartbeat para mantener conexión activa
    this.startHeartbeat();
  }

  private setupSessionMonitoring() {
    this.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Supabase token refreshed successfully');
      } else if (event === 'SIGNED_OUT') {
        console.log('Supabase session ended');
        this.stopHeartbeat();
      } else if (event === 'SIGNED_IN') {
        console.log('Supabase session started');
        this.startHeartbeat();
      }
    });
  }

  private startHeartbeat() {
    // Limpiar heartbeat anterior si existe
    this.stopHeartbeat();

    console.log('Starting Supabase connection heartbeat');

    // Ejecutar heartbeat cada 50 segundos
    this.heartbeatInterval = setInterval(async () => {
      try {
        const {
          data: { session },
        } = await this.supabaseClient.auth.getSession();

        if (session) {
          // Hacer una query muy ligera para mantener conexión activa
          // Esto fuerza a Supabase a mantener la conexión HTTP abierta
          await this.supabaseClient
            .from('obras')
            .select('id', { count: 'exact', head: true })
            .limit(0);

          console.log('Heartbeat: connection kept alive');
        }
      } catch (error) {
        console.warn('Heartbeat failed:', error);
        // Si falla el heartbeat, intentar refrescar sesión
        await this.refreshSession();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      console.log('Stopping Supabase connection heartbeat');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async refreshSession() {
    try {
      const { data, error } = await this.supabaseClient.auth.refreshSession();
      if (error) {
        console.error('Error refreshing Supabase session:', error);
        return false;
      }
      console.log('Supabase session refreshed manually');
      return true;
    } catch (error) {
      console.error('Exception refreshing Supabase session:', error);
      return false;
    }
  }

  ngOnDestroy() {
    this.stopHeartbeat();
  }
}
