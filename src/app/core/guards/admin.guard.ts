import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Esperar a que la inicialización termine completamente
    const maxWaitTime = 5000; // 5 segundos máximo
    const startTime = Date.now();

    // Esperar a que termine la carga inicial
    while (authService.isLoading() && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Si después del tiempo de espera aún está cargando, verificar sesión directamente
    if (authService.isLoading()) {
      console.warn('Auth service still loading, checking session directly');
      const { data } = await authService.session();

      if (!data.session?.user) {
        router.navigate(['/autenticacion/iniciar-sesion']);
        return false;
      }

      // Dar un poco más de tiempo para que se cargue el perfil
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Verificar si es admin
    if (authService.isAdmin()) {
      return true;
    }

    // Verificar si al menos está autenticado
    if (authService.isAuthenticated()) {
      // Usuario autenticado pero no admin
      router.navigate(['/']);
      return false;
    } else {
      // Verificar una vez más la sesión antes de redirigir
      const { data } = await authService.session();

      if (data.session?.user) {
        // Hay sesión pero el perfil no se cargó correctamente
        console.warn(
          'Session exists but profile not loaded, attempting refresh'
        );
        await authService.refreshUserProfile();

        // Verificar nuevamente después del refresh
        if (authService.isAdmin()) {
          return true;
        } else if (authService.isAuthenticated()) {
          router.navigate(['/']);
          return false;
        }
      }

      // No autenticado
      router.navigate(['/autenticacion/iniciar-sesion']);
      return false;
    }
  } catch (error) {
    console.error('Error in admin guard:', error);

    // En caso de error, verificar sesión una vez más
    try {
      const { data } = await authService.session();
      if (data.session?.user) {
        // Hay sesión, intentar recuperar
        await authService.reinitializeAuth();

        if (authService.isAdmin()) {
          return true;
        } else if (authService.isAuthenticated()) {
          router.navigate(['/']);
          return false;
        }
      }
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    }

    router.navigate(['/autenticacion/iniciar-sesion']);
    return false;
  }
};
