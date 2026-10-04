import { Routes } from '@angular/router';
import { featureGuard } from '../../core/guards/feature.guard';

export const EVENT_RSVP_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureGuard('eventRsvps')],
    loadComponent: () =>
      import('./event-rsvp-list/event-rsvp-list.component').then(
        module => module.EventRsvpListComponent,
      ),
  },
  {
    path: ':id/attendees',
    canActivate: [featureGuard('eventRsvps')],
    loadComponent: () =>
      import('./event-rsvp-attendees/event-rsvp-attendees.component').then(
        module => module.EventRsvpAttendeesComponent,
      ),
  },
];
