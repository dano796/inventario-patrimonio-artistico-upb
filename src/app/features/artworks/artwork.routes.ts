import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

/**
 * Rutas cargadas de forma diferida: un visitante anonimo solo descarga el
 * listado, no el formulario de administracion ni sus dependencias.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/artwork-list/artwork-list.component').then(
        (m) => m.ArtworkListComponent
      ),
  },
  {
    path: 'nueva',
    title: 'Nueva obra | Inventario Patrimonio Artístico UPB',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./components/artwork-form/artwork-form.component').then(
        (m) => m.ArtworkFormComponent
      ),
  },
  {
    path: 'editar/:id',
    title: 'Editar obra | Inventario Patrimonio Artístico UPB',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./components/artwork-form/artwork-form.component').then(
        (m) => m.ArtworkFormComponent
      ),
  },
  {
    path: 'obra/:id',
    title: 'Detalle de obra | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/artwork-detail/artwork-detail.component').then(
        (m) => m.ArtworkDetailComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
