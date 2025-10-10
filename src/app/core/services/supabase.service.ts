import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from './../../../environments/environment.development';
import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService implements OnDestroy {
  // Reinicializar completamente el cliente Supabase
  reinitializeClient() {
    console.warn(
      'Reinitializing Supabase client due to inactivity or session failure'
    );
    this.stopHeartbeat();
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
      }
    );
    this.setupSessionMonitoring();
    this.startHeartbeat();
    this.lastActivityTime = Date.now();
  }
  supabaseClient: SupabaseClient;
  private heartbeatInterval: any = null;
  private readonly HEARTBEAT_INTERVAL = 4 * 60 * 1000; // 4 minutos (menos agresivo)
  private isHeartbeatActive = false;
  private lastActivityTime = Date.now();
  private readonly INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutos

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
    this.isHeartbeatActive = true;

    // Ejecutar heartbeat cada 4 minutos (menos intrusivo)
    this.heartbeatInterval = setInterval(async () => {
      // Solo ejecutar si no hay requests activos
      if (!this.isHeartbeatActive) {
        return;
      }

      try {
        const {
          data: { session },
        } = await this.supabaseClient.auth.getSession();

        if (session) {
          // Solo refrescar la sesión, no hacer queries adicionales
          // Esto evita interferencias con requests reales
          console.log('Heartbeat: checking session');
        } else {
          // Si no hay sesión, intentar refrescar
          await this.refreshSession();
        }
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      console.log('Stopping Supabase connection heartbeat');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.isHeartbeatActive = false;
    }
  }

  // Método para pausar heartbeat temporalmente durante requests
  pauseHeartbeat() {
    this.isHeartbeatActive = false;
  }

  // Método para reanudar heartbeat
  resumeHeartbeat() {
    this.isHeartbeatActive = true;
  }

  async refreshSession() {
    try {
      const { data, error } = await this.supabaseClient.auth.refreshSession();
      if (error) {
        console.error('Error refreshing Supabase session:', error);
        return false;
      }
      console.log('Supabase session refreshed manually');
      this.lastActivityTime = Date.now(); // Actualizar tiempo de actividad
      return true;
    } catch (error) {
      console.error('Exception refreshing Supabase session:', error);
      return false;
    }
  }

  // Método para verificar y garantizar que la sesión está activa
  async ensureActiveSession(): Promise<boolean> {
    try {
      const inactiveTime = Date.now() - this.lastActivityTime;
      // Si ha pasado más del umbral de inactividad, reinicializar el cliente
      if (inactiveTime > this.INACTIVITY_THRESHOLD) {
        console.warn(
          `Inactivity detected (${Math.round(
            inactiveTime / 1000
          )}s), reinitializing client`
        );
        this.reinitializeClient();
        // Esperar un momento para que la sesión se estabilice
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Verificar que la sesión existe
      const {
        data: { session },
      } = await this.supabaseClient.auth.getSession();

      if (!session) {
        // Intentar refrescar sesión
        const refreshed = await this.refreshSession();
        if (!refreshed) {
          // Si no se puede refrescar, reinicializar cliente y forzar recarga
          this.reinitializeClient();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          // Intentar obtener sesión de nuevo
          const {
            data: { session: session2 },
          } = await this.supabaseClient.auth.getSession();
          if (!session2) {
            console.error('No active session after client reinit');
            return false;
          }
        }
      }

      // Actualizar tiempo de última actividad
      this.lastActivityTime = Date.now();
      return true;
    } catch (error) {
      console.error('Error ensuring active session:', error);
      this.reinitializeClient();
      return false;
    }
  }

  // Método para marcar actividad reciente
  markActivity() {
    this.lastActivityTime = Date.now();
  }

  // Verificar si hay inactividad prolongada
  hasBeenInactive(): boolean {
    const inactiveTime = Date.now() - this.lastActivityTime;
    return inactiveTime > this.INACTIVITY_THRESHOLD;
  }

  ngOnDestroy() {
    this.stopHeartbeat();
  }
}
