import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const BULLETINS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('bulletin')],
    loadComponent: () =>
      import('./bulletins-list/bulletins-list.component').then(m => m.BulletinsListComponent),
  },
  {
    path: ':publicId',
    canActivate: [featureGuard('bulletin')],
    loadComponent: () =>
      import('./bulletin-editor/bulletin-editor.component').then(m => m.BulletinEditorComponent),
  },
];
