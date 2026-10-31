import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

/**
 * Two tabs of 통계 (#277): `/analytics` keeps the charts, `/analytics/long-absences`
 * is the 장기결석자 follow-up. Same guard on both; the static path comes first.
 */
export const STATISTICS_ROUTES: Routes = [
  {
    path: 'long-absences',
    canActivate: [featureGuard('analytics')],
    loadComponent: () =>
      import('./long-absent/long-absent-page.component').then(m => m.LongAbsentPageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [featureGuard('analytics')],
    loadComponent: () =>
      import('./statistics-dashboard/statistics-dashboard.component').then(
        m => m.StatisticsDashboardComponent,
      ),
  },
];
