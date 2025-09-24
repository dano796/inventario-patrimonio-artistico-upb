import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Esperar máximo 2 segundos por la carga del perfil
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 2000);
    });

    const checkAuthPromise = new Promise<boolean>((resolve) => {
      // Si ya está cargado
      if (!authService.isLoading()) {
        resolve(authService.isAdmin());
        return;
      }

      // Esperar a que termine de cargar
      const checkInterval = setInterval(() => {
        if (!authService.isLoading()) {
          clearInterval(checkInterval);
          resolve(authService.isAdmin());
        }
      }, 100);

      // Timeout de seguridad
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 1500);
    });

    const isAdmin = await Promise.race([checkAuthPromise, timeoutPromise]);

    if (isAdmin) {
      return true;
    }

    // Verificar si al menos está autenticado
    if (authService.isAuthenticated()) {
      // Usuario autenticado pero no admin
      router.navigate(['/']);
      return false;
    } else {
      // No autenticado
      router.navigate(['/auth/log-in']);
      return false;
    }
  } catch (error) {
    console.error('Error in admin guard:', error);
    router.navigate(['/auth/log-in']);
    return false;
  }
};
