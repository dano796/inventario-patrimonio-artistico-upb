import { Routes } from '@angular/router';
import { routes as AuthRoutes } from './features/auth/auth.routes';
import { routes as ArtworkRoutes } from './features/artworks/artwork.routes';
import { routes as SincronizacionRoutes } from './features/sincronizacion/sincronizacion.routes';
import { privateGuard, publicGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'autenticacion',
    canActivate: [publicGuard],
    children: AuthRoutes,
  },
  {
    path: 'sincronizacion',
    canActivate: [adminGuard],
    children: SincronizacionRoutes,
  },
  {
    path: 'tablero',
    title: 'Tablero | Inventario Patrimonio Artístico UPB',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/tablero/components/tablero/tablero.component').then((m) => m.TableroComponent),
  },
  {
    path: '',
    children: ArtworkRoutes,
  },
];
