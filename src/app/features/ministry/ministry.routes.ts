import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const MINISTRY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ministry-list/ministry-list.component').then(m => m.MinistryListComponent),
    canActivate: [featureGuard('ministry')],
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./ministry-edit/ministry-edit.component').then(m => m.MinistryEditComponent),
    canActivate: [featureGuard('ministry')],
  },
  {
    path: ':publicId',
    loadComponent: () =>
      import('./ministry-detail/ministry-detail.component').then(m => m.MinistryDetailComponent),
    canActivate: [featureGuard('ministry')],
  },
  {
    path: ':publicId/edit',
    loadComponent: () =>
      import('./ministry-edit/ministry-edit.component').then(m => m.MinistryEditComponent),
    canActivate: [featureGuard('ministry')],
  },
];
