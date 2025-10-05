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
  private loadingProfile = signal<boolean>(false);
  private initializationPromise: Promise<void> | null = null;
  private profileCache = new Map<
    string,
    { profile: UserProfile; timestamp: number }
  >();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // Computed para verificar si el usuario es admin
  isAdmin = computed(() => {
    const profile = this.userProfile();
    return profile?.rol === 'admin';
  });

  // Computed para verificar si está autenticado
  isAuthenticated = computed(() => {
    return this.userProfile() !== null;
  });

  // Computed para verificar si está cargando
  isLoading = computed(() => {
    return this.loadingProfile();
  });

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Evitar múltiples inicializaciones simultáneas
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitializeAuth();
    return this.initializationPromise;
  }

  private async doInitializeAuth() {
    try {
      // Timeout más agresivo para la inicialización
      const sessionPromise = this.session();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session timeout')), 5000)
      );

      const { data } = (await Promise.race([
        sessionPromise,
        timeoutPromise,
      ])) as any;

      if (data.session?.user) {
        await this.loadUserProfile(data.session.user.id, true);
      } else {
        this.userProfile.set(null);
        this.loadingProfile.set(false);
      }
    } catch (error) {
      console.warn('Error initializing auth (will retry):', error);
      // En caso de error de inicialización, establecer estado por defecto
      this.userProfile.set(null);
      this.loadingProfile.set(false);

      // Reintento después de 2 segundos
      setTimeout(() => {
        this.initializationPromise = null;
        this.initializeAuth();
      }, 2000);
    } finally {
      this.initializationPromise = null;
    }

    // Escuchar cambios de autenticación
    this.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          await this.loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          this.userProfile.set(null);
          this.loadingProfile.set(false);
          this.clearCache();
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        this.userProfile.set(null);
        this.loadingProfile.set(false);
      }
    });
  }

  private async loadUserProfile(
    userId: string,
    isInitialLoad: boolean = false
  ) {
    // Prevenir carga múltiple
    if (this.loadingProfile() && !isInitialLoad) {
      return;
    }

    // Verificar cache primero
    const cached = this.getCachedProfile(userId);
    if (cached) {
      this.userProfile.set(cached);
      this.loadingProfile.set(false);
      return;
    }

    this.loadingProfile.set(true);

    try {
      // Timeout más largo y diferenciado para evitar errores prematuros
      const timeoutDuration = isInitialLoad ? 12000 : 15000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Profile load timeout')),
          timeoutDuration
        )
      );

      const profilePromise = this.supabaseClient
        .from('usuarios')
        .select('id, rol')
        .eq('id', userId)
        .single();

      const { data, error } = (await Promise.race([
        profilePromise,
        timeoutPromise,
      ])) as any;

      if (error) {
        console.error('Error loading user profile:', error);
        // En caso de error, establecer un perfil por defecto si hay sesión válida
        const { data: sessionData } = await this.session();
        if (sessionData.session?.user?.id === userId) {
          // Usuario autenticado pero sin perfil en tabla usuarios
          const defaultProfile: UserProfile = { id: userId, rol: 'user' };
          this.userProfile.set(defaultProfile);
        } else {
          this.userProfile.set(null);
        }
        this.loadingProfile.set(false);
        return;
      }

      // Cache el resultado exitoso
      this.setCachedProfile(userId, data);
      this.userProfile.set(data);
      this.loadingProfile.set(false);
    } catch (error) {
      console.warn('Error loading user profile:', error);

      // En caso de timeout o error, usar fallback más robusto
      try {
        const { data: sessionData } = (await Promise.race([
          this.session(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session check timeout')), 8000)
          ),
        ])) as any;

        if (sessionData.session?.user?.id === userId) {
          // Usuario autenticado pero no se pudo cargar el perfil
          const fallbackProfile: UserProfile = { id: userId, rol: 'user' };
          this.userProfile.set(fallbackProfile);
        } else {
          this.userProfile.set(null);
        }
      } catch (sessionError) {
        console.warn('Session check also failed:', sessionError);
        // Fallback final: asumir usuario no autenticado
        this.userProfile.set(null);
      }
      this.loadingProfile.set(false);
    }
  }

  private getCachedProfile(userId: string): UserProfile | null {
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.profile;
    }
    return null;
  }

  private setCachedProfile(userId: string, profile: UserProfile) {
    this.profileCache.set(userId, {
      profile,
      timestamp: Date.now(),
    });
  }

  private clearCache() {
    this.profileCache.clear();
  }

  // Método público para refrescar el perfil del usuario
  async refreshUserProfile() {
    const { data } = await this.session();
    if (data.session?.user) {
      // Limpiar cache para forzar recarga
      this.profileCache.delete(data.session.user.id);
      await this.loadUserProfile(data.session.user.id);
    }
  }

  // Método público para reinicializar autenticación en caso de problemas
  async reinitializeAuth() {
    this.initializationPromise = null;
    this.userProfile.set(null);
    this.loadingProfile.set(false);
    this.clearCache();
    await this.initializeAuth();
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
