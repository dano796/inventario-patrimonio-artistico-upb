import { Routes } from '@angular/router';
import { AuthSignUpComponent } from './components/auth-sign-up/auth-sign-up.component';
import { AuthLogInComponent } from './components/auth-log-in/auth-log-in.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { UpdatePasswordComponent } from './components/update-password/update-password.component';

export const routes: Routes = [
  {
    path: 'registro',
    component: AuthSignUpComponent,
  },
  {
    path: 'iniciar-sesion',
    component: AuthLogInComponent,
  },
  {
    path: 'recuperar-contrasena',
    component: ForgotPasswordComponent,
  },
  {
    path: 'actualizar-contrasena',
    component: UpdatePasswordComponent,
  },
  {
    path: '**',
    redirectTo: 'iniciar-sesion',
    pathMatch: 'full',
  },
];
