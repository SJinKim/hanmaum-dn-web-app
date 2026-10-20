import { CanDeactivateFn, Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

import type { GuideAreasComponent } from './guide-areas.component';

const canLeave: CanDeactivateFn<GuideAreasComponent> = (...args) =>
  args[0].state.saving() ? false : unsavedChangesGuard(...args);

export const GUIDE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'counting-areas' },
  {
    path: 'counting-areas',
    canActivate: [featureGuard('guide')],
    canDeactivate: [canLeave],
    loadComponent: () => import('./guide-areas.component').then(m => m.GuideAreasComponent),
  },
];
