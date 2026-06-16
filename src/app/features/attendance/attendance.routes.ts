import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/auth.guard';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./attendance-definitions/attendance-definitions.component').then(
        m => m.AttendanceDefinitionsComponent,
      ),
  },
  {
    path: ':id/group-counts',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./attendance-logs/attendance-logs.component').then(
        m => m.AttendanceLogsComponent,
      ),
  },
  {
    path: ':id/logs',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./attendance-logs/attendance-logs.component').then(
        m => m.AttendanceLogsComponent,
      ),
  },
];
