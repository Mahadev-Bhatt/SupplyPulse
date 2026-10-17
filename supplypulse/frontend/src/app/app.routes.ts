import { Routes } from '@angular/router';
import { guard } from './app.config';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./login.component').then(m => m.LoginComponent) },
  { path: 'dashboard', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.DashboardComponent) },
  { path: 'inventory', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.InventoryComponent) },
  { path: 'forecast', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.ForecastComponent) },
  { path: 'replenishment', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.ReplenishmentComponent) },
  { path: 'shipments', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.ShipmentsComponent) },
  { path: 'suppliers', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.SuppliersComponent) },
  { path: 'scenarios', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.ScenariosComponent) },
  { path: 'alerts', canActivate: [guard], loadComponent: () => import('./pages').then(m => m.AlertsComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' }
];
