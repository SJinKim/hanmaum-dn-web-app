import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/auth.guard';

export const EVENT_RSVP_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./event-rsvp-list/event-rsvp-list.component').then(
        module => module.EventRsvpListComponent,
      ),
  },
  {
    path: ':id/attendees',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./event-rsvp-attendees/event-rsvp-attendees.component').then(
        module => module.EventRsvpAttendeesComponent,
      ),
  },
];
