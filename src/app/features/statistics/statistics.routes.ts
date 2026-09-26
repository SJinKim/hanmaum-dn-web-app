import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/auth.guard';

export const STATISTICS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./statistics-dashboard/statistics-dashboard.component').then(
        m => m.StatisticsDashboardComponent,
      ),
  },
];
