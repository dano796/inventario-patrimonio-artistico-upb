import { Routes } from '@angular/router';
import { AuthSignUpComponent } from './components/auth-sign-up/auth-sign-up.component';
import { AuthLogInComponent } from './components/auth-log-in/auth-log-in.component';

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
    path: '**',
    redirectTo: 'iniciar-sesion',
    pathMatch: 'full',
  },
];
