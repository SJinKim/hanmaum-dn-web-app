import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const NEWCOMERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('newcomers')],
    loadComponent: () =>
      import('./newcomers-list/newcomers-list.component').then(m => m.NewcomersListComponent),
  },
  {
    path: 'new',
    canActivate: [featureGuard('newcomers', 'write')],
    loadComponent: () =>
      import('./newcomer-edit/newcomer-edit.component').then(m => m.NewcomerEditComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: ':publicId',
    canActivate: [featureGuard('newcomers')],
    loadComponent: () =>
      import('./newcomer-detail/newcomer-detail.component').then(m => m.NewcomerDetailComponent),
  },
  {
    path: ':publicId/edit',
    canActivate: [featureGuard('newcomers', 'write')],
    loadComponent: () =>
      import('./newcomer-edit/newcomer-edit.component').then(m => m.NewcomerEditComponent),
    canDeactivate: [unsavedChangesGuard],
  },
];
