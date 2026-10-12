import { NavRole } from './nav-config';

/**
 * Figma: role matrix 254:3 — the eight rows of the Home screen, and which of the
 * three columns (순장 / 관리자 / 목사님) sees each one.
 *
 * `design-specs/DESIGN.md` §9: a block a role may not see is *absent*. No greyed
 * out card, no tooltip, no lock icon — the grid closes up as if the block did not
 * exist. So this registry answers one question per block ("render it?") and the
 * template has no second opinion.
 *
 * The matrix, verbatim:
 *
 * | Block            | 순장        | 관리자 | 목사님 |
 * |------------------|-------------|--------|--------|
 * | 승인 대기        | —           | ✓      | ✓      |
 * | 응답 대기        | ✓           | ✓      | ✓      |
 * | 장기 미출석자    | —           | —      | ✓      |
 * | 순별 참석 현황   | 자기 순만   | 전체   | 전체   |
 * | 현황             | 자기 순 기준| 전체   | 전체   |
 * | 최근 활동        | 자기 순 기준| ✓      | ✓      |
 * | 다가오는 일정    | ✓           | ✓      | ✓      |
 * | 통계 화면        | —           | —      | ✓      |
 *
 * #211 adds a row outside the 254:3 matrix: 일요일 순별 참석 현황 (Figma
 * 1218:121934) for 총무 (`general_operations_viewer` / `_editor`), admin and
 * pastor. 총무 reads no member list and no 행사 list, so every block that needs
 * one is hidden for them — they see 응답 대기 and this block only.
 */
export type HomeBlockId =
  | 'pendingApprovals'
  | 'awaitingRsvps'
  | 'longAbsent'
  | 'groupAttendance'
  | 'overview'
  | 'recentActivity'
  | 'upcomingEvents'
  | 'statistics'
  | 'sundayGroupCounts';

/**
 * How much data a block shows. `own-group` is the matrix's "자기 순만" / "자기 순
 * 기준" — it needs the caller's 순, which comes from Keycloak *group* membership
 * and not from a role. Figma states that outright, so the scope is declared here
 * and stays unreachable until #47 creates the groups.
 */
export type HomeBlockScope = 'all' | 'own-group';

export interface HomeBlock {
  readonly id: HomeBlockId;
  /**
   * Any one of these roles may see the block. Omitted = every authenticated
   * user, which is the matrix's three-✓ row. A realm role outside `NavRole`
   * (e.g. `general_operations_viewer`) is matched case-insensitively.
   */
  readonly roles?: readonly string[];
  /** Roles that see their own 순 instead of the whole church. */
  readonly ownGroupRoles?: readonly NavRole[];
  /**
   * Realm roles that lose the block unless they also hold a `SUPER_ROLES` role.
   * `note_taker` reads no member list (hanmaum-dn-server#305), so 순별 참석 has
   * no roster and 최근 활동 no members to show (#205, #207). 총무 may read
   * neither the member list nor `/members/count` nor the 행사 list (#211).
   */
  readonly hiddenForRoles?: readonly string[];
  /**
   * No endpoint backs this block yet, so it is absent for everyone regardless of
   * role — same reasoning as `NavItem.pending`. 장기 미출석자 has no attendance
   * query behind it in `openapi.yaml`, and 통계 화면 is the `/analytics` screen
   * (#60), reached through the navigation rather than drawn on Home.
   */
  readonly pending?: boolean;
}

const GENERAL_OPERATIONS_ROLES = ['general_operations_viewer', 'general_operations_editor'] as const;

export const HOME_BLOCKS: readonly HomeBlock[] = [
  { id: 'pendingApprovals', roles: ['admin', 'pastor'] },
  { id: 'awaitingRsvps' },
  { id: 'longAbsent', roles: ['pastor'], pending: true },
  {
    id: 'groupAttendance',
    ownGroupRoles: ['leader'],
    hiddenForRoles: ['note_taker', ...GENERAL_OPERATIONS_ROLES],
  },
  { id: 'overview', ownGroupRoles: ['leader'], hiddenForRoles: GENERAL_OPERATIONS_ROLES },
  {
    id: 'recentActivity',
    ownGroupRoles: ['leader'],
    hiddenForRoles: ['note_taker', ...GENERAL_OPERATIONS_ROLES],
  },
  { id: 'upcomingEvents', hiddenForRoles: GENERAL_OPERATIONS_ROLES },
  { id: 'statistics', roles: ['pastor'], pending: true },
  { id: 'sundayGroupCounts', roles: ['admin', 'pastor', ...GENERAL_OPERATIONS_ROLES] },
];
