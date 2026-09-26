import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const MEMBERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('members')],
    loadComponent: () =>
      import('./members-list/members-list.component').then(m => m.MembersListComponent),
  },
  {
    path: 'new',
    canActivate: [featureGuard('members')],
    loadComponent: () =>
      import('./member-edit/member-edit.component').then(m => m.MemberEditComponent),
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: ':publicId',
    canActivate: [featureGuard('members')],
    loadComponent: () =>
      import('./member-detail/member-detail.component').then(m => m.MemberDetailComponent),
  },
  {
    path: ':publicId/edit',
    canActivate: [featureGuard('members')],
    loadComponent: () =>
      import('./member-edit/member-edit.component').then(m => m.MemberEditComponent),
    canDeactivate: [unsavedChangesGuard],
  },
];
