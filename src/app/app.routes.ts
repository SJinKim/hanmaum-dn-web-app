// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './shell/shell.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'members',
        loadChildren: () =>
          import('./features/members/members.routes').then(m => m.MEMBERS_ROUTES),
      },
      {
        path: 'ministry',
        loadChildren: () =>
          import('./features/ministry/ministry.routes').then(m => m.MINISTRY_ROUTES),
      },
      {
        path: 'attendance',
        loadChildren: () =>
          import('./features/attendance/attendance.routes').then(m => m.ATTENDANCE_ROUTES),
      },
      {
        path: 'event-rsvps',
        loadChildren: () =>
          import('./features/event-rsvps/event-rsvp.routes').then(m => m.EVENT_RSVP_ROUTES),
      },
      {
        path: 'announcements',
        loadChildren: () =>
          import('./features/announcements/announcements.routes').then(m => m.ANNOUNCEMENTS_ROUTES),
      },
      {
        // Reference screen for the Figma Controls & Containers layer — see design-specs/DESIGN.md.
        path: 'design-ui',
        loadComponent: () =>
          import('./core/ui/ui-sandbox/ui-sandbox.component')
            .then(m => m.UiSandboxComponent),
      },
      {
        // Reference screen for the Figma token layer — see design-specs/DESIGN.md.
        path: 'design-tokens',
        loadComponent: () =>
          import('./core/ui/token-sandbox/token-sandbox.component')
            .then(m => m.TokenSandboxComponent),
      },
      {
        path: 'church-groups',
        loadChildren: () =>
          import('./features/church-groups/church-groups.routes')
            .then(m => m.CHURCH_GROUPS_ROUTES),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/',
  },
];
