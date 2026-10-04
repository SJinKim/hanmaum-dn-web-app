// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { webAccessGuard } from './core/guards/web-access.guard';
import { featureGuard } from './core/guards/feature.guard';
import { ShellComponent } from './shell/shell.component';

export const APP_ROUTES: Routes = [
  // QR 등록 링크 (#42): public, outside the shell and without login.
  {
    path: 'register/:token',
    loadComponent: () =>
      import('./features/public-register/public-register.component').then(m => m.PublicRegisterComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [webAccessGuard],
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
        path: 'newcomers',
        loadChildren: () =>
          import('./features/newcomers/newcomers.routes').then(m => m.NEWCOMERS_ROUTES),
      },
      {
        path: 'quick-records',
        canActivate: [featureGuard('newcomers')],
        loadComponent: () =>
          import('./features/newcomers/newcomer-visits/newcomer-visits.component').then(
            m => m.NewcomerVisitsComponent,
          ),
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
        // Reference screen for the Figma data-display layer — see design-specs/DESIGN.md.
        path: 'design-data',
        loadComponent: () =>
          import('./core/ui/data-sandbox/data-sandbox.component')
            .then(m => m.DataSandboxComponent),
      },
      {
        path: 'analytics',
        loadChildren: () =>
          import('./features/statistics/statistics.routes')
            .then(m => m.STATISTICS_ROUTES),
      },
      {
        path: 'church-groups',
        loadChildren: () =>
          import('./features/church-groups/church-groups.routes')
            .then(m => m.CHURCH_GROUPS_ROUTES),
      },
      {
        path: 'archive',
        loadChildren: () =>
          import('./features/archive/archive.routes')
            .then(m => m.ARCHIVE_ROUTES),
      },
      {
        // Figma 745:41755 — where `featureGuard` sends a URL the role matrix denies.
        path: 'forbidden',
        loadComponent: () =>
          import('./features/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/',
  },
];
