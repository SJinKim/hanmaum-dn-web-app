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
 * pastor. 총무 reads no member list, so every block that needs one is hidden
 * for them — they see 응답 대기 and this block only. #213 opens the 행사 list
 * to 총무, but 다가오는 일정 stays hidden: the 총무 Home in Figma has no such block.
 *
 * #206 adds 이번 주 순별 체크인 (Figma Admin 1212:123108, 순장 1212:122922): the
 * current week's Sunday check-ins as tiles, refreshed live on a Sunday. 순장,
 * 총무, admin and pastor see it; the 새가족 roles do not.
 *
 * #202 adds 빠른 기록 · 최근 방문 (Figma 1210:121909) for the 새가족 roles
 * (`newcomer_viewer` / `_editor`). They see that block and nothing else.
 *
 * #205 opens 승인 대기 to `note_taker`: the count only, from `/members/count`.
 * 승인하기 leads to 청년, which `note_taker` may not read, so the template shows
 * that button only to a role that may write `members`.
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
  | 'sundayGroupCounts'
  | 'sundayCheckins'
  | 'quickRecords'
  | 'guide';

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
   * neither the member list nor `/members/count` (#211); 다가오는 일정 stays
   * hidden for them because the 총무 Home in Figma leaves it out, even though
   * #213 lets them read the 행사 list. The 새가족 roles see 빠른 기록 only
   * (#202), so every other block is hidden for them.
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
/** 양육팀 (#214) reads 양육 only, so the 청년-data blocks are hidden for them. */
const TRAINING_ROLES = ['training_viewer', 'training_editor'] as const;
const LEADER_ROLES = ['group_leader', 'leader'] as const;
const NEWCOMER_ROLES = ['newcomer_viewer', 'newcomer_editor'] as const;

export const HOME_BLOCKS: readonly HomeBlock[] = [
  { id: 'guide', roles: ['admin', 'pastor', 'guide_viewer', 'guide_editor'] },
  { id: 'pendingApprovals', roles: ['admin', 'pastor', 'note_taker'] },
  { id: 'awaitingRsvps', hiddenForRoles: NEWCOMER_ROLES },
  { id: 'longAbsent', roles: ['pastor'], pending: true },
  {
    id: 'groupAttendance',
    ownGroupRoles: ['leader'],
    hiddenForRoles: ['note_taker', ...GENERAL_OPERATIONS_ROLES, ...TRAINING_ROLES, ...NEWCOMER_ROLES],
  },
  {
    id: 'overview',
    ownGroupRoles: ['leader'],
    hiddenForRoles: [...GENERAL_OPERATIONS_ROLES, ...TRAINING_ROLES, ...NEWCOMER_ROLES],
  },
  {
    id: 'recentActivity',
    ownGroupRoles: ['leader'],
    hiddenForRoles: ['note_taker', ...GENERAL_OPERATIONS_ROLES, ...TRAINING_ROLES, ...NEWCOMER_ROLES],
  },
  { id: 'upcomingEvents', hiddenForRoles: [...GENERAL_OPERATIONS_ROLES, ...NEWCOMER_ROLES] },
  { id: 'statistics', roles: ['pastor'], pending: true },
  { id: 'sundayGroupCounts', roles: ['admin', 'pastor', ...GENERAL_OPERATIONS_ROLES] },
  { id: 'sundayCheckins', roles: ['admin', 'pastor', ...LEADER_ROLES, ...GENERAL_OPERATIONS_ROLES] },
  { id: 'quickRecords', roles: ['admin', 'pastor', ...NEWCOMER_ROLES] },
];

export type HomeGroupId = 'attention' | 'sunday' | 'newcomers' | 'church' | 'guide';

export interface HomeGroup {
  id: HomeGroupId;
  blocks: readonly HomeBlockId[];
}

/**
 * #222: Home folds into four accordion groups. Which blocks a role sees still
 * comes from `HOME_BLOCKS` alone; a group is a layout bucket and shows when at
 * least one of its blocks does. A group with no visible block is absent (§9).
 * Pending blocks keep their home here so they slot in once they ship.
 */
export const HOME_GROUPS: readonly HomeGroup[] = [
  { id: 'guide', blocks: ['guide'] },
  { id: 'attention', blocks: ['pendingApprovals', 'awaitingRsvps', 'longAbsent'] },
  { id: 'sunday', blocks: ['sundayGroupCounts', 'sundayCheckins', 'groupAttendance'] },
  { id: 'newcomers', blocks: ['quickRecords'] },
  { id: 'church', blocks: ['overview', 'recentActivity', 'upcomingEvents', 'statistics'] },
];
