import { Routes } from '@angular/router';
import { routes as AuthRoutes } from './features/auth/auth-shell/auth.routing';
import { privateGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [publicGuard],
    children: AuthRoutes,
  },
  {
    path: 'obras',
    loadChildren: () =>
      import('./features/artworks/artwork-shell/artwork.routing').then(
        (m) => m.routes
      ),
  },
  {
    path: '',
    redirectTo: '/obras',
    pathMatch: 'full',
  },
];
