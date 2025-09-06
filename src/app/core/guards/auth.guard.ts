import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { CanActivate, CanActivateFn, Router } from '@angular/router';

const routerInjection = () => inject(Router);
const authServiceInjection = () => inject(AuthService);

export const privateGuard: CanActivateFn = async () => {
  const router = routerInjection();
  const { data } = await authServiceInjection().session();

  if (!data.session) {
    router.navigateByUrl('auth/log-in');
  }

  return !!data.session;
};

export const publicGuard: CanActivateFn = async () => {
  const router = routerInjection();
  const { data } = await authServiceInjection().session();

  if (data.session) {
    router.navigateByUrl('/');
  }

  return !data.session;
};
