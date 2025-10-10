import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { CanActivate, CanActivateFn, Router } from '@angular/router';

const routerInjection = () => inject(Router);
const authServiceInjection = () => inject(AuthService);

export const privateGuard: CanActivateFn = async () => {
  const router = routerInjection();
  const authService = authServiceInjection();

  try {
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });

    const checkAuthPromise = new Promise<boolean>((resolve) => {
      if (!authService.isLoading()) {
        resolve(authService.isAuthenticated());
        return;
      }

      const checkInterval = setInterval(() => {
        if (!authService.isLoading()) {
          clearInterval(checkInterval);
          resolve(authService.isAuthenticated());
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(authService.isAuthenticated());
      }, 1200);
    });

    const isAuthenticated = await Promise.race([
      checkAuthPromise,
      timeoutPromise,
    ]);

    if (!isAuthenticated) {
      router.navigateByUrl('/autenticacion/iniciar-sesion');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in privateGuard:', error);
    router.navigateByUrl('/autenticacion/iniciar-sesion');
    return false;
  }
};

export const publicGuard: CanActivateFn = async () => {
  const router = routerInjection();
  const authService = authServiceInjection();

  try {
    // Esperar máximo 1 segundo para rutas públicas
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 1000); // Permitir acceso en caso de timeout
    });

    const checkAuthPromise = new Promise<boolean>((resolve) => {
      // Si ya está cargado
      if (!authService.isLoading()) {
        if (authService.isAuthenticated()) {
          router.navigateByUrl('/');
          resolve(false);
        } else {
          resolve(true);
        }
        return;
      }

      // Esperar a que termine de cargar
      const checkInterval = setInterval(() => {
        if (!authService.isLoading()) {
          clearInterval(checkInterval);
          if (authService.isAuthenticated()) {
            router.navigateByUrl('/');
            resolve(false);
          } else {
            resolve(true);
          }
        }
      }, 100);

      // Timeout de seguridad
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(true); // En caso de timeout, permitir acceso a rutas públicas
      }, 800);
    });

    return await Promise.race([checkAuthPromise, timeoutPromise]);
  } catch (error) {
    console.error('Error in publicGuard:', error);
    // En caso de error, permitir acceso a rutas públicas
    return true;
  }
};
