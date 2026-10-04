import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';
import { ChurchGroupsListComponent } from './church-groups-list/church-groups-list.component';

export const CHURCH_GROUPS_ROUTES: Routes = [
  { path: '', component: ChurchGroupsListComponent, canActivate: [featureGuard('churchGroups')] },
];
