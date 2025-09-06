import { Routes } from '@angular/router';
import { AuthSignUpComponent } from '../auth-sign-up/auth-sign-up.component';
import { AuthLogInComponent } from '../auth-log-in/auth-log-in.component';

export const routes: Routes = [
  {
    path: 'sign-up',
    component: AuthSignUpComponent,
  },
  {
    path: 'log-in',
    component: AuthLogInComponent,
  },
  {
    path: '**',
    redirectTo: 'log-in',
    pathMatch: 'full',
  },
];
