import { Routes } from '@angular/router';

/**
 * El registro publico de usuarios esta deshabilitado a proposito: este es un
 * inventario institucional interno y las cuentas las crea un administrador
 * desde el panel de Supabase. Recordar desactivar tambien los signups en
 * Supabase -> Authentication -> Sign In / Providers, porque quitar la ruta
 * no impide llamar a supabase.auth.signUp() directamente.
 */
export const routes: Routes = [
  {
    path: 'iniciar-sesion',
    title: 'Iniciar sesión | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/auth-log-in/auth-log-in.component').then(
        (m) => m.AuthLogInComponent
      ),
  },
  {
    path: 'recuperar-contrasena',
    title: 'Recuperar contraseña | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'actualizar-contrasena',
    title: 'Actualizar contraseña | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/update-password/update-password.component').then(
        (m) => m.UpdatePasswordComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'iniciar-sesion',
    pathMatch: 'full',
  },
];
