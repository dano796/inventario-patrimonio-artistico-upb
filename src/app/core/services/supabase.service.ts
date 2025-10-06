import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from './../../../environments/environment.development';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  supabaseClient: SupabaseClient;

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
  }

  private setupSessionMonitoring() {
    this.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Supabase token refreshed successfully');
      } else if (event === 'SIGNED_OUT') {
        console.log('Supabase session ended');
      } else if (event === 'SIGNED_IN') {
        console.log('Supabase session started');
      }
    });
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
}
