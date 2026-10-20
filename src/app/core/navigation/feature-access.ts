/**
 * Figma: 08 · Roles — Bildschirm-Zugriff (883:164). Which Keycloak realm role
 * may read and which may write each screen. The sidebar, the route guards, the
 * header and the CRUD buttons all read this one table, so a screen can never be
 * visible in the navigation but blocked by its route, or the other way round.
 *
 * Roles are compared case-insensitively — Keycloak hands them out as written in
 * the realm, and the realm is not consistent about case.
 *
 * Realm prerequisites (see `docs/roles.md`):
 * - `admin` and `pastor` read and write every screen. `pastor` and `note_taker`
 *   become realm roles with server#240.
 * - 순장 is `group_leader` in the realm; `leader` is accepted as well because the
 *   matrix names it that way.
 * - Only who can read a screen other than home gets into the web app at all
 *   (`hasWebAccess`). Everyone else lands on the 403 "화면 준비 중" variant.
 *
 * Adding a ministry team with its own screen: add a `FeatureId`, give it
 * `{ read: ['<slug>_viewer', '<slug>_editor'], write: ['<slug>_editor'] }` and
 * route it behind `featureGuard`. The team gets web access from that row alone.
 */

export type FeatureId =
  | 'guide'
  | 'home'
  | 'members'
  | 'newcomers'
  | 'churchGroups'
  | 'attendance'
  | 'eventRsvps'
  | 'ministry'
  | 'announcements'
  | 'archive'
  | 'analytics'
  | 'bulletin';

/** Realm roles that read and write every screen. */
export const SUPER_ROLES: readonly string[] = ['admin', 'pastor'];

const LEADER_ROLES = ['group_leader', 'leader'] as const;

/** 총괄팀 (#213): the viewer reads, the editor also writes. */
const GENERAL_OPERATIONS_READ = ['general_operations_viewer', 'general_operations_editor'] as const;
const GENERAL_OPERATIONS_WRITE = ['general_operations_editor'] as const;

/** 양육팀 (#214): the viewer reads 양육, the editor also writes. */
const TRAINING_READ = ['training_viewer', 'training_editor'] as const;
const TRAINING_WRITE = ['training_editor'] as const;

/**
 * Extra roles per feature, on top of `SUPER_ROLES`. `read: 'all'` = every
 * authenticated user. A write role should also be a read role.
 */
export interface FeatureAccess {
  readonly read: 'all' | readonly string[];
  readonly write: readonly string[];
}

const NONE: FeatureAccess = { read: [], write: [] };
const GENERAL_OPERATIONS: FeatureAccess = { read: GENERAL_OPERATIONS_READ, write: GENERAL_OPERATIONS_WRITE };
/**
 * 출석, 이벤트, 주보 (#205) and 공지사항: 총괄팀 plus `note_taker`, who reads and writes
 * them since hanmaum-dn-server#305. `note_taker` reads no 청년 and no 양육.
 */
const GENERAL_OPERATIONS_AND_NOTE_TAKER: FeatureAccess = {
  read: ['note_taker', ...GENERAL_OPERATIONS_READ],
  write: ['note_taker', ...GENERAL_OPERATIONS_WRITE],
};

export const FEATURE_ACCESS: Readonly<Record<FeatureId, FeatureAccess>> = {
  home: { read: 'all', write: [] },
  guide: { read: ['guide_viewer', 'guide_editor'], write: ['guide_editor'] },
  members: NONE,
  newcomers: { read: ['newcomer_viewer', 'newcomer_editor'], write: ['newcomer_editor'] },
  churchGroups: { read: [...LEADER_ROLES, ...TRAINING_READ], write: TRAINING_WRITE },
  attendance: GENERAL_OPERATIONS_AND_NOTE_TAKER,
  eventRsvps: GENERAL_OPERATIONS_AND_NOTE_TAKER,
  ministry: GENERAL_OPERATIONS,
  announcements: GENERAL_OPERATIONS_AND_NOTE_TAKER,
  archive: NONE,
  analytics: NONE,
  bulletin: GENERAL_OPERATIONS_AND_NOTE_TAKER,
};

/**
 * Who may permanently delete a member (#144). Narrower than the members write row:
 * the server allows `DELETE /v1/members/{publicId}/permanent` to ADMIN only.
 */
export const MEMBER_PURGE_ROLES: readonly string[] = ['admin'];
