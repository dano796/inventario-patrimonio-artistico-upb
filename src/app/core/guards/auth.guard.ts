import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';

const routerInjection = () => inject(Router);
const authServiceInjection = () => inject(AuthService);

export const privateGuard: CanActivateFn = async () => {
  const router = routerInjection();
  const authService = authServiceInjection();

  await authService.listo();

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigateByUrl('/autenticacion/iniciar-sesion');
  return false;
};

export const publicGuard: CanActivateFn = async (
  _route,
  state: RouterStateSnapshot
) => {
  const router = routerInjection();
  const authService = authServiceInjection();

  // Excepcion necesaria para el flujo de recuperacion de contrasena: esta ruta
  // debe abrirse aunque ya haya una sesion iniciada.
  if (state.url.includes('/autenticacion/actualizar-contrasena')) {
    return true;
  }

  await authService.listo();

  if (authService.isAuthenticated()) {
    router.navigateByUrl('/');
    return false;
  }

  return true;
};
