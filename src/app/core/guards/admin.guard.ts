import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si el usuario está autenticado y es admin
  if (authService.isAdmin()) {
    return true;
  }

  // Redirigir al login si no está autenticado o no es admin
  router.navigate(['/auth/login']);
  return false;
};
