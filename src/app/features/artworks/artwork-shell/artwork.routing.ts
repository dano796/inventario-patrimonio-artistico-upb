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
    path: 'new',
    component: ArtworkFormComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'edit/:id',
    component: ArtworkFormComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'artwork/:id',
    component: ArtworkDetailComponent,
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
