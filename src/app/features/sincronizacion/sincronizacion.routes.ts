import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Sincronización | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/sincronizar/sincronizar.component').then((m) => m.SincronizarComponent),
  },
  {
    path: 'vincular',
    title: 'Vincular Excel | Inventario Patrimonio Artístico UPB',
    loadComponent: () =>
      import('./components/vincular-hoja/vincular-hoja.component').then((m) => m.VincularHojaComponent),
  },
];
