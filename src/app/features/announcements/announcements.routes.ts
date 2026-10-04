import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('announcements')],
    loadComponent: () =>
      import('./announcements-list/announcements-list.component').then(
        m => m.AnnouncementsListComponent,
      ),
  },
];
