import { Routes } from '@angular/router';
import { ArtworkListComponent } from '../artwork-list/artwork-list.component';
import { ArtworkDetailComponent } from '../artwork-detail/artwork-detail.component';
import { ArtworkFormComponent } from '../artwork-form/artwork-form.component';
import { adminGuard } from '../../../core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    component: ArtworkListComponent,
  },
  {
    path: 'nueva',
    component: ArtworkFormComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'editar/:id',
    component: ArtworkFormComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'obra/:id',
    component: ArtworkDetailComponent,
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
