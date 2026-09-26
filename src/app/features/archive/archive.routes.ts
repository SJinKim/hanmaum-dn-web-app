import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/auth.guard';

export const ARCHIVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./archive.component').then(m => m.ArchiveComponent),
    canActivate: [adminGuard],
  },
];
