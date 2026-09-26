import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('attendance')],
    loadComponent: () =>
      import('./attendance-definitions/attendance-definitions.component').then(
        m => m.AttendanceDefinitionsComponent,
      ),
  },
  {
    path: ':id/group-counts',
    canActivate: [featureGuard('attendance')],
    loadComponent: () =>
      import('./attendance-logs/attendance-logs.component').then(
        m => m.AttendanceLogsComponent,
      ),
  },
  {
    path: ':id/logs',
    canActivate: [featureGuard('attendance')],
    loadComponent: () =>
      import('./attendance-logs/attendance-logs.component').then(
        m => m.AttendanceLogsComponent,
      ),
  },
];
