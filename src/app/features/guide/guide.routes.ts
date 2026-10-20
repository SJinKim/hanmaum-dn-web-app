import { CanDeactivateFn, Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { guideFormGuard } from './guide-form.guard';
import type { GuideHistoryComponent } from './guide-history.component';

const historyGuard: CanDeactivateFn<GuideHistoryComponent> = component => component.canLeave();
export const GUIDE_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', canActivate: [featureGuard('guide')], canDeactivate: [historyGuard],
    loadComponent: () => import('./guide-history.component').then(m => m.GuideHistoryComponent),
  },
  {
    path: 'counting-areas', canActivate: [featureGuard('guide')], canDeactivate: [guideFormGuard],
    loadComponent: () => import('./guide-areas.component').then(m => m.GuideAreasComponent),
  },
  {
    path: 'records/:publicId/edit', canActivate: [featureGuard('guide', 'write')], canDeactivate: [guideFormGuard],
    loadComponent: () => import('./guide-summary-editor.component').then(m => m.GuideSummaryEditorComponent),
  },
  { path: 'statistics', canActivate: [featureGuard('guide')], loadComponent: () => import('./guide-statistics.component').then(m => m.GuideStatisticsComponent) },
];
