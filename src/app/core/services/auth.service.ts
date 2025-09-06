import { Injectable, inject, computed, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type {
  SignUpWithPasswordCredentials,
  SignInWithPasswordCredentials,
} from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  rol: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabaseClient = inject(SupabaseService).supabaseClient;
  private userProfile = signal<UserProfile | null>(null);

  // Computed para verificar si el usuario es admin
  isAdmin = computed(() => {
    const profile = this.userProfile();
    return profile?.rol === 'admin';
  });

  // Computed para verificar si está autenticado
  isAuthenticated = computed(() => {
    return this.userProfile() !== null;
  });

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    const { data } = await this.session();
    if (data.session?.user) {
      await this.loadUserProfile(data.session.user.id);
    }

    // Escuchar cambios de autenticación
    this.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await this.loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        this.userProfile.set(null);
      }
    });
  }

  private async loadUserProfile(userId: string) {
    try {
      const { data, error } = await this.supabaseClient
        .from('usuarios')
        .select('id, rol')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        this.userProfile.set(null);
        return;
      }

      this.userProfile.set(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.userProfile.set(null);
    }
  }

  session() {
    return this.supabaseClient.auth.getSession();
  }

  signUp(credentials: SignUpWithPasswordCredentials) {
    return this.supabaseClient.auth.signUp(credentials);
  }

  logIn(credentials: SignInWithPasswordCredentials) {
    return this.supabaseClient.auth.signInWithPassword(credentials);
  }

  signOut() {
    return this.supabaseClient.auth.signOut();
  }

  // Método adicional para obtener el usuario actual
  getCurrentUser() {
    return this.supabaseClient.auth.getUser();
  }

  // Método para escuchar cambios en la autenticación
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabaseClient.auth.onAuthStateChange(callback);
  }
}
