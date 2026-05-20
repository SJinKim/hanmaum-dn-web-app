import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/auth.guard';

export const ANNOUNCEMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./announcements-list/announcements-list.component').then(
        m => m.AnnouncementsListComponent,
      ),
  },
];
