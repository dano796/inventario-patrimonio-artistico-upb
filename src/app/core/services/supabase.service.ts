import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from './../../../environments/environment.development';
import { Injectable, OnDestroy } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService implements OnDestroy {
  // Reinicializar completamente el cliente Supabase
  reinitializeClient() {
    this.stopHeartbeat();
    this.supabaseClient = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          // Allow supabase-js to detect and process session tokens present in the URL
          detectSessionInUrl: true,
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
          // Allow supabase-js to detect and process session tokens present in the URL
          detectSessionInUrl: true,
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
      if (event === 'SIGNED_OUT') {
        this.stopHeartbeat();
      } else if (event === 'SIGNED_IN') {
        this.startHeartbeat();
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    this.isHeartbeatActive = true;

    this.heartbeatInterval = setInterval(async () => {
      if (!this.isHeartbeatActive) {
        return;
      }

      try {
        const {
          data: { session },
        } = await this.supabaseClient.auth.getSession();

        if (!session) {
          await this.refreshSession();
        }
      } catch (error) {
        console.warn('Heartbeat failed:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
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
      this.lastActivityTime = Date.now();
      return true;
    } catch (error) {
      console.error('Exception refreshing Supabase session:', error);
      return false;
    }
  }

  // Método para verificar y garantizar que la sesión está activa (si existe)
  // Permite acceso anónimo cuando no hay sesión
  async ensureActiveSession(): Promise<boolean> {
    try {
      // Verificar si hay sesión
      const {
        data: { session },
      } = await this.supabaseClient.auth.getSession();

      // Si NO hay sesión, es acceso anónimo - permitirlo
      if (!session) {
        return true;
      }

      // Si hay sesión, verificar inactividad
      const inactiveTime = Date.now() - this.lastActivityTime;
      if (inactiveTime > this.INACTIVITY_THRESHOLD) {
        console.warn(
          `Inactivity detected (${Math.round(
            inactiveTime / 1000
          )}s), refreshing session`
        );

        // Intentar refrescar sesión
        const refreshed = await this.refreshSession();
        if (!refreshed) {
          console.warn('Session refresh failed, reinitializing client');
          this.reinitializeClient();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Actualizar tiempo de última actividad
      this.lastActivityTime = Date.now();
      return true;
    } catch (error) {
      console.error('Error ensuring active session:', error);
      // En caso de error, permitir acceso anónimo
      return true;
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
