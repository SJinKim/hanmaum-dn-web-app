/**
 * Figma: 08 · Roles — role matrix (254:3). Which Keycloak realm role may open
 * which screen. The sidebar, the route guards and the header all read this one
 * table, so a screen can never be visible in the navigation but blocked by its
 * route, or the other way round.
 *
 * Roles are compared case-insensitively — Keycloak hands them out as written in
 * the realm, and the realm is not consistent about case.
 *
 * Realm prerequisites (see `docs/roles.md`):
 * - `admin` and `pastor` open every screen. `pastor` is designed but not yet a
 *   realm role, so today only `admin` does.
 * - 순장 is `group_leader` in the realm; `leader` is accepted as well because the
 *   matrix names it that way.
 * - Screens whose writes the server only allows to `ADMIN` stay admin-only here.
 *   Opening them wider would only show a user buttons that answer with 403.
 */

export type FeatureId =
  | 'home'
  | 'members'
  | 'newcomers'
  | 'churchGroups'
  | 'attendance'
  | 'eventRsvps'
  | 'ministry'
  | 'announcements'
  | 'archive'
  | 'analytics';

/** Realm roles that open every screen. */
export const SUPER_ROLES: readonly string[] = ['admin', 'pastor'];

const LEADER_ROLES = ['group_leader', 'leader'] as const;

/**
 * Extra roles per feature, on top of `SUPER_ROLES`. `'all'` = every
 * authenticated user.
 */
export const FEATURE_ACCESS: Readonly<Record<FeatureId, 'all' | readonly string[]>> = {
  home: 'all',
  members: [],
  newcomers: ['newcomer_viewer', 'newcomer_editor'],
  churchGroups: LEADER_ROLES,
  attendance: [],
  eventRsvps: [],
  ministry: [],
  announcements: [],
  archive: [],
  analytics: [],
};
