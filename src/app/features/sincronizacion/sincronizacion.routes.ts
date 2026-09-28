import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'vincular',
    title: 'Vincular hoja | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/vincular-hoja/vincular-hoja.component').then((m) => m.VincularHojaComponent),
  },
];
