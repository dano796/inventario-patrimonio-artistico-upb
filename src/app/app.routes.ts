import { Routes } from '@angular/router';
import { routes as AuthRoutes } from './features/auth/auth.routes';
import { routes as ArtworkRoutes } from './features/artworks/artwork.routes';
import { privateGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'autenticacion',
    canActivate: [publicGuard],
    children: AuthRoutes,
  },
  {
    path: '',
    children: ArtworkRoutes,
  },
];
