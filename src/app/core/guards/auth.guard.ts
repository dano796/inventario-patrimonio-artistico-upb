import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import {
  CanActivate,
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';

const routerInjection = () => inject(Router);
const authServiceInjection = () => inject(AuthService);

export const privateGuard: CanActivateFn = async () => {
  const router = routerInjection();
  const authService = authServiceInjection();

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
      console.warn(
        'Auth service still loading in privateGuard, checking session directly'
      );
      const { data } = await authService.session();

      if (!data.session?.user) {
        router.navigateByUrl('/autenticacion/iniciar-sesion');
        return false;
      }

      // Dar un poco más de tiempo para que se cargue el perfil
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Verificar autenticación
    if (authService.isAuthenticated()) {
      return true;
    }

    // Verificar una vez más la sesión antes de redirigir
    const { data } = await authService.session();

    if (data.session?.user) {
      // Hay sesión pero el perfil no se cargó correctamente
      console.warn(
        'Session exists but profile not loaded in privateGuard, attempting refresh'
      );
      await authService.refreshUserProfile();

      // Verificar nuevamente después del refresh
      if (authService.isAuthenticated()) {
        return true;
      }
    }

    // No autenticado
    router.navigateByUrl('/autenticacion/iniciar-sesion');
    return false;
  } catch (error) {
    console.error('Error in privateGuard:', error);

    // En caso de error, verificar sesión una vez más
    try {
      const { data } = await authService.session();
      if (data.session?.user) {
        // Hay sesión, intentar recuperar
        await authService.reinitializeAuth();

        if (authService.isAuthenticated()) {
          return true;
        }
      }
    } catch (retryError) {
      console.error('Retry failed in privateGuard:', retryError);
    }

    router.navigateByUrl('/autenticacion/iniciar-sesion');
    return false;
  }
};

export const publicGuard: CanActivateFn = async (route, state) => {
  const router = routerInjection();
  const authService = authServiceInjection();

  try {
    // Permitir acceso a la ruta de actualización de contraseña incluso si hay sesión
    // Esta es una excepción necesaria para el flujo de recuperación de contraseña
    if (state.url.includes('/autenticacion/actualizar-contrasena')) {
      return true;
    }

    // Esperar a que la inicialización termine completamente, pero con menos tiempo para rutas públicas
    const maxWaitTime = 3000; // 3 segundos máximo
    const startTime = Date.now();

    // Esperar a que termine la carga inicial
    while (authService.isLoading() && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Si después del tiempo de espera aún está cargando, permitir acceso
    if (authService.isLoading()) {
      console.warn(
        'Auth service still loading in publicGuard, allowing access'
      );
      return true;
    }

    // Si está autenticado, redirigir al home
    if (authService.isAuthenticated()) {
      router.navigateByUrl('/');
      return false;
    }

    // Verificar una vez más la sesión por si acaso
    const { data } = await authService.session();

    if (data.session?.user) {
      // Hay sesión, redirigir al home
      router.navigateByUrl('/');
      return false;
    }

    // No autenticado, permitir acceso a rutas públicas
    return true;
  } catch (error) {
    console.error('Error in publicGuard:', error);
    // En caso de error, permitir acceso a rutas públicas
    return true;
  }
};
