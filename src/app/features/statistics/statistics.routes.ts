import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const STATISTICS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('analytics')],
    loadComponent: () =>
      import('./statistics-dashboard/statistics-dashboard.component').then(
        m => m.StatisticsDashboardComponent,
      ),
  },
];
