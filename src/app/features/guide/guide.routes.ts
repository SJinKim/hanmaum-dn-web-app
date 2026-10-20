import { CanDeactivateFn, Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

import type { GuideAreasComponent } from './guide-areas.component';

const canLeave: CanDeactivateFn<GuideAreasComponent> = (...args) => {
  const component = args[0];
  if (component.state.saving()) {
    component.navigationBlocked.set(true);
    return false;
  }
  component.routeConfirming.set(true);
  const result = unsavedChangesGuard(...args);
  if (result instanceof Promise) return result.finally(() => component.routeConfirming.set(false));
  component.routeConfirming.set(false);
  return result;
};

export const GUIDE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'counting-areas' },
  {
    path: 'counting-areas',
    canActivate: [featureGuard('guide')],
    canDeactivate: [canLeave],
    loadComponent: () => import('./guide-areas.component').then(m => m.GuideAreasComponent),
  },
];
