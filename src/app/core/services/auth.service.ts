import { Injectable, inject, computed, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type {
  SignUpWithPasswordCredentials,
  SignInWithPasswordCredentials,
} from '@supabase/supabase-js';
import { UserProfile } from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  supabaseService = inject(SupabaseService);
  private supabaseClient = this.supabaseService.supabaseClient;
  private userProfile = signal<UserProfile | null>(null);
  private loadingProfile = signal<boolean>(false);
  private initializationPromise: Promise<void> | null = null;
  private reinitializePromise: Promise<void> | null = null;
  private profileLoadPromise: Promise<void> | null = null;
  private profileCache = new Map<
    string,
    { profile: UserProfile; timestamp: number }
  >();
  /**
   * Vive aparte de initializationPromise porque este se pone en null al terminar
   * doInitializeAuth(): un guard que llegue justo despues no debe perder la senal.
   */
  private readyPromise: Promise<void>;
  private static readonly TIEMPO_MAXIMO_INICIALIZACION_MS = 5000;

  /**
   * Se lee de forma sincrona al construir el servicio porque supabase-js
   * (detectSessionInUrl) consume y limpia el fragmento de la URL enseguida.
   * Sin esta foto no quedaria rastro de que la visita venia de un enlace
   * de recuperacion.
   */
  private readonly recoveryLinkDetected = ((): boolean => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash.replace(/^#/, '');
    const search = window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(
      [hash, search].filter(Boolean).join('&')
    );
    if (params.get('type') === 'recovery') return true;
    // Flujo PKCE: ?code=... sobre la ruta de actualizar contrasena
    return (
      params.has('code') &&
      window.location.pathname.includes('actualizar-contrasena')
    );
  })();

  /** Supabase emite PASSWORD_RECOVERY al procesar un enlace de recuperacion. */
  private passwordRecoveryEvent = signal(false);

  /**
   * True solo si esta carga de pagina proviene de un enlace de recuperacion.
   * Tener una sesion abierta NO basta: si bastara, cualquiera que encontrara
   * un navegador con sesion iniciada podria cambiar la contrasena.
   */
  isRecoveryFlow = computed(
    () => this.recoveryLinkDetected || this.passwordRecoveryEvent()
  );
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
    this.readyPromise = this.initializeAuth();
  }

  listo(): Promise<void> {
    return this.readyPromise;
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
    // Si getSession() o la consulta a `usuarios` se cuelgan (lock de
    // supabase-js, cliente viejo tras reinitializeClient), este tope resuelve
    // -no rechaza- en vez de dejar listo() esperando para siempre: si no,
    // los guards ni siquiera podrian llegar a la pantalla de iniciar sesion.
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<void>((resolve) => {
      temporizador = setTimeout(() => {
        console.warn('Auth initialization timed out, asumiendo sin sesión');
        this.userProfile.set(null);
        this.loadingProfile.set(false);
        resolve();
      }, AuthService.TIEMPO_MAXIMO_INICIALIZACION_MS);
    });

    // Si pierde la carrera contra el tope y rechaza mas tarde, el .catch va
    // enganchado aqui mismo: si no, quedaria como un rechazo sin capturar.
    const cargaSesionYPerfil = this.cargarSesionYPerfil().catch((error) => {
      console.warn('Error initializing auth:', error);
      this.userProfile.set(null);
      this.loadingProfile.set(false);
    });

    await Promise.race([cargaSesionYPerfil, tope]);
    clearTimeout(temporizador);
    this.initializationPromise = null;

    // Escuchar cambios de autenticación
    this.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'PASSWORD_RECOVERY') {
          this.passwordRecoveryEvent.set(true);
        }

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

  private async cargarSesionYPerfil(): Promise<void> {
    const { data } = await this.session();

    if (data.session?.user) {
      await this.loadUserProfile(data.session.user.id, true);
    } else {
      this.userProfile.set(null);
      this.loadingProfile.set(false);
    }
  }

  private async loadUserProfile(
    userId: string,
    isInitialLoad: boolean = false
  ): Promise<void> {
    // Espera la carga ya en curso en vez de salir sin hacer nada: quien
    // llama (p. ej. el guard via refreshUserProfile()) necesita el resultado.
    if (this.profileLoadPromise && !isInitialLoad) {
      return this.profileLoadPromise;
    }

    const promise = this.fetchAndSetUserProfile(userId);
    this.profileLoadPromise = promise;
    try {
      await promise;
    } finally {
      if (this.profileLoadPromise === promise) {
        this.profileLoadPromise = null;
      }
    }
  }

  private async fetchAndSetUserProfile(userId: string): Promise<void> {
    // Verificar cache primero
    const cached = this.getCachedProfile(userId);
    if (cached) {
      this.userProfile.set(cached);
      this.loadingProfile.set(false);
      return;
    }

    this.loadingProfile.set(true);

    try {
      // Intentar cargar perfil de la base de datos
      const { data, error } = await this.supabaseClient
        .from('usuarios')
        .select('id, rol')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn(
          'Profile not found in database, using default:',
          error.message
        );
        // Usuario autenticado pero sin perfil en tabla usuarios - usar perfil por defecto
        const defaultProfile: UserProfile = { id: userId, rol: 'user' };
        this.userProfile.set(defaultProfile);
        this.setCachedProfile(userId, defaultProfile);
        this.loadingProfile.set(false);
        return;
      }

      // Cache el resultado exitoso
      this.setCachedProfile(userId, data);
      this.userProfile.set(data);
      this.loadingProfile.set(false);
    } catch (error) {
      console.error('Error loading user profile:', error);

      // Usar perfil por defecto en caso de error
      const fallbackProfile: UserProfile = { id: userId, rol: 'user' };
      this.userProfile.set(fallbackProfile);
      this.setCachedProfile(userId, fallbackProfile);
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
    // Evitar múltiples reinicializaciones simultáneas
    if (this.reinitializePromise) {
      return this.reinitializePromise;
    }

    this.reinitializePromise = this.doReinitializeAuth();

    try {
      await this.reinitializePromise;
    } finally {
      this.reinitializePromise = null;
    }
  }

  private async doReinitializeAuth() {
    // 1. Intentar refrescar la sesión de Supabase primero
    const refreshed = await this.supabaseService.refreshSession();

    if (!refreshed) {
      console.warn('Could not refresh Supabase session');
    }

    // 2. Resetear estado local
    this.initializationPromise = null;
    this.userProfile.set(null);
    this.loadingProfile.set(false);
    this.clearCache();

    // 3. Reinicializar (listo() debe reflejar esta nueva inicializacion, no la anterior)
    this.readyPromise = this.initializeAuth();
    await this.readyPromise;
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

  /**
   * El proveedor es single tenant: el directorio de la UPB decide quien
   * existe, aqui no se comprueba el dominio del correo.
   */
  logInWithMicrosoft() {
    return this.supabaseClient.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email',
        redirectTo: `${window.location.protocol}//${window.location.host}/`,
      },
    });
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

  // Método para solicitar reseteo de contraseña
  async resetPassword(email: string) {
    const redirectUrl = `${window.location.protocol}//${window.location.host}/autenticacion/actualizar-contrasena`;

    const result = await this.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    return result;
  }

  // Método para actualizar contraseña
  updatePassword(newPassword: string) {
    return this.supabaseClient.auth.updateUser({
      password: newPassword,
    });
  }

  // Método para verificar si hay una sesión de recuperación activa
  async isRecoverySession(): Promise<boolean> {
    try {
      const { data } = await this.session();

      if (!data.session) {
        return false;
      }

      return this.isRecoveryFlow();
    } catch (error) {
      return false;
    }
  }

  // Método para procesar automáticamente enlaces de recuperación
  async processRecoveryUrl(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isRecoveryFlow()) {
        return {
          success: false,
          error: 'Esta página solo es accesible desde un enlace de recuperación',
        };
      }

      // Intentar usar API oficial para procesar la URL (supabase-js v2+)
      // @ts-ignore - métodos dependientes de la versión
      if (typeof this.supabaseClient.auth.getSessionFromUrl === 'function') {
        const result = await (
          this.supabaseClient.auth as any
        ).getSessionFromUrl();
        if (result?.data?.session) {
          return { success: true };
        }
        if (result?.error) {
          return {
            success: false,
            error: result.error.message || 'Error procesando URL',
          };
        }
      }

      // Alternativa: si detectSessionInUrl está activado, la sesión ya existe.
      // Solo se acepta cuando esta carga viene de un enlace de recuperación:
      // una sesión normal no autoriza a cambiar la contraseña.
      const { data, error } = await this.supabaseClient.auth.getSession();
      if (error) return { success: false, error: error.message };
      if (data.session && this.isRecoveryFlow()) return { success: true };

      // Fallback manual: parsear fragment (#access_token=...&refresh_token=...)
      const hash = window.location.hash.replace(/^#/, '');
      if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token) {
          try {
            if (refresh_token) {
              await this.supabaseClient.auth.setSession({
                access_token,
                refresh_token,
              });
            } else {
              await this.supabaseClient.auth.setSession({
                access_token,
                refresh_token: '' as any,
              });
            }

            // Limpiar fragmento de URL para evitar reprocesos
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );

            // Confirmar que la sesión ahora existe
            const { data: newData } =
              await this.supabaseClient.auth.getSession();
            if (newData.session) return { success: true };
          } catch (e: any) {
            return {
              success: false,
              error:
                e?.message ||
                'Error al establecer la sesión desde el fragmento',
            };
          }
        }
      }

      return {
        success: false,
        error: 'No se encontró una sesión válida en el enlace',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error procesando el enlace de recuperación',
      };
    }
  }
}
