import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.listo();

  if (authService.isAdmin()) {
    return true;
  }

  if (authService.isAuthenticated()) {
    router.navigate(['/']);
    return false;
  }

  router.navigate(['/autenticacion/iniciar-sesion']);
  return false;
};
