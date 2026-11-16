import { Routes } from '@angular/router';

/**
 * Sin guard: el panel y el diálogo se abren sin sesión y la inician ellos. Lo
 * que protege los datos es la RLS, igual que en el resto de la aplicación.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Sincronizar | Inventario Patrimonio Artístico UPB',
    loadComponent: () => import('./components/panel/panel.component').then((m) => m.PanelComponent),
  },
  {
    path: 'entrar',
    title: 'Iniciar sesión | Inventario Patrimonio Artístico UPB',
    loadComponent: () => import('./components/entrar/entrar.component').then((m) => m.EntrarComponent),
  },
];
