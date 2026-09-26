import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const ARCHIVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./archive.component').then(m => m.ArchiveComponent),
    canActivate: [featureGuard('archive')],
  },
];
