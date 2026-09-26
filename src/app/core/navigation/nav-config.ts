/**
 * Figma: 06 · Components — Navigation (26:7) — Sidebar (157:1651),
 * NavItem (156:56), NavGroupLabel (156:57), Drawer (157:1738).
 *
 * The single source for what the navigation contains. Sidebar, Drawer and any
 * future launcher render this list — no route, label or icon is hardcoded in a
 * template. #32/#47 only have to make `RoleService` answer for real Keycloak
 * roles; nothing about the markup changes when they land.
 *
 * Icons are `pi pi-*` classes: the Figma `Icon` component (60:28) is declared a
 * "PrimeIcons 7.0.0 subset", so the class name *is* the design token here and no
 * SVG is exported.
 */

import { FeatureId } from './feature-access';

/**
 * Roles as the Figma role matrix (254:3) names them. Only `admin` exists in the
 * Keycloak realm today — see `RoleService` for how the other two resolve.
 */
export type NavRole = 'admin' | 'leader' | 'pastor';

export interface NavItem {
  /** i18n key under `nav.items.*`. */
  readonly labelKey: string;
  readonly icon: string;
  readonly route: string;
  /** `routerLinkActiveOptions.exact` — only the root route needs it. */
  readonly exact?: boolean;
  /**
   * The role-matrix row (`feature-access.ts`) that decides visibility — the
   * same row the route guard checks. Gated items are absent, not disabled.
   */
  readonly feature: FeatureId;
  /**
   * The screen behind this entry is not routed yet (#39 newcomers, #60
   * analytics, #31 archive). The entry stays here so the structure is complete
   * and reviewable; it is filtered out of the rendered navigation until the
   * route exists, because a nav item that lands on the `**` redirect is worse
   * than a missing one.
   */
  readonly pending?: boolean;
}

export interface NavGroup {
  /** i18n key under `nav.groups.*`. */
  readonly labelKey: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    labelKey: 'nav.groups.people',
    items: [
      { labelKey: 'nav.items.home', feature: 'home', icon: 'pi pi-home', route: '/', exact: true },
      { labelKey: 'nav.items.members', feature: 'members', icon: 'pi pi-users', route: '/members' },
      { labelKey: 'nav.items.newcomers', feature: 'newcomers', icon: 'pi pi-user-plus', route: '/newcomers', pending: true },
      { labelKey: 'nav.items.churchGroups', feature: 'churchGroups', icon: 'pi pi-th-large', route: '/church-groups' },
    ],
  },
  {
    labelKey: 'nav.groups.activity',
    items: [
      { labelKey: 'nav.items.attendance', feature: 'attendance', icon: 'pi pi-check-square', route: '/attendance' },
      { labelKey: 'nav.items.eventRsvps', feature: 'eventRsvps', icon: 'pi pi-calendar-plus', route: '/event-rsvps' },
      { labelKey: 'nav.items.ministry', feature: 'ministry', icon: 'pi pi-sitemap', route: '/ministry' },
    ],
  },
  {
    labelKey: 'nav.groups.admin',
    items: [
      { labelKey: 'nav.items.announcements', feature: 'announcements', icon: 'pi pi-megaphone', route: '/announcements' },
      { labelKey: 'nav.items.archive', feature: 'archive', icon: 'pi pi-inbox', route: '/archive', pending: true },
      {
        labelKey: 'nav.items.analytics',
        icon: 'pi pi-chart-bar',
        route: '/analytics',
        feature: 'analytics',
        pending: true,
      },
    ],
  },
];
