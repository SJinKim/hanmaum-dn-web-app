import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { TrainingCatalogService } from '../../core/services/training-catalog.service';
import { PageResponse } from '../../core/models/api-response.model';
import { Baptism, ChurchGroupSummary } from '../../core/models/member.model';
import { SummaryTraining } from '../../core/models/member-activity.model';
import { MemberStageInput, memberPillStage } from '../../core/models/member-stage';
import { MemberPillStage } from '../../core/ui/variant-tokens';

export type MemberCategory =
  | 'NEXT_LEADER'
  | 'DISCIPLESHIP_COMPLETED'
  | 'ONE_ON_ONE_COMPLETED'
  | 'ONE_ON_ONE_IN_PROGRESS'
  | 'ONE_ON_ONE_WAITING'
  | 'QBS_COMPLETED'
  | 'UNBAPTIZED'
  | 'DEFAULT';

export interface CategoryConfig {
  label: string;
  color: string;
}

export const CATEGORY_CONFIG: Record<MemberCategory, CategoryConfig> = {
  NEXT_LEADER:            { label: '예비순장',         color: '#f9a8d4' },
  DISCIPLESHIP_COMPLETED: { label: '제자반수료',       color: '#e9d5ff' },
  ONE_ON_ONE_COMPLETED:   { label: '일대일수료',       color: '#99f6e4' },
  ONE_ON_ONE_IN_PROGRESS: { label: '일대일진행',       color: '#bbf7d0' },
  ONE_ON_ONE_WAITING:     { label: '일대일대기',       color: '#fef08a' },
  QBS_COMPLETED:          { label: '큐베세수료',       color: '#bae6fd' },
  UNBAPTIZED:             { label: '세례X / 확인대상', color: '#fed7aa' },
  DEFAULT:                { label: '',                 color: '#f9fafb' },
};

export const FILTER_CATEGORIES: MemberCategory[] = [
  'NEXT_LEADER',
  'DISCIPLESHIP_COMPLETED',
  'ONE_ON_ONE_COMPLETED',
  'ONE_ON_ONE_IN_PROGRESS',
  'ONE_ON_ONE_WAITING',
  'QBS_COMPLETED',
  'UNBAPTIZED',
];

/** The matrix names the same eight buckets the MemberPill Stage axis does. */
const CATEGORY_BY_STAGE: Record<MemberPillStage, MemberCategory> = {
  'next-leader':          'NEXT_LEADER',
  'discipleship':         'DISCIPLESHIP_COMPLETED',
  'one-on-one-completed': 'ONE_ON_ONE_COMPLETED',
  'one-on-one-progress':  'ONE_ON_ONE_IN_PROGRESS',
  'one-on-one-waiting':   'ONE_ON_ONE_WAITING',
  'qbs':                  'QBS_COMPLETED',
  'unbaptized':           'UNBAPTIZED',
  'none':                 'DEFAULT',
};

/** The inverse of the stage → category mapping, for rendering a cell as a MemberPill. */
export const STAGE_BY_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_BY_STAGE).map(([stage, category]) => [category, stage]),
) as Record<MemberCategory, MemberPillStage>;

/**
 * Which block of the 양육 table a group belongs to (#234). The server stores
 * `division` as free text: "느헤미야" / "다니엘" in the data, the codes NEHEMIA /
 * DANIEL in older records, so both spellings are recognised.
 */
export type DivisionKind = 'NEHEMIA' | 'DANIEL' | 'OTHER' | 'NEWCOMERS';

const DIVISION_ALIASES: Record<string, DivisionKind> = {
  '느헤미야': 'NEHEMIA',
  NEHEMIA: 'NEHEMIA',
  NEHEMIAH: 'NEHEMIA',
  '다니엘': 'DANIEL',
  DANIEL: 'DANIEL',
};

/**
 * Left to right in Figma 215:7645: 느헤미야, 다니엘, then any unknown division,
 * and 새가족 always at the right end. The order of the 순 inside a block is the
 * server's.
 */
const DIVISION_RANK: Record<DivisionKind, number> = { NEHEMIA: 0, DANIEL: 1, OTHER: 2, NEWCOMERS: 3 };

/**
 * Name of the 새가족 group. It is an ordinary church_groups row (its division is
 * empty), but also acts as the catch-all column for any member that somehow has
 * no group. The server flags it as `is_newcomer_group` but does not expose the
 * flag yet, so the name is matched the way the server's own migration did.
 */
export const NEWCOMERS_GROUP_NAME = '새가족';

export function divisionKind(group: Pick<ChurchGroupSummary, 'division' | 'name'>): DivisionKind {
  if (group.name.includes(NEWCOMERS_GROUP_NAME)) return 'NEWCOMERS';
  const division = (group.division ?? '').trim();
  return DIVISION_ALIASES[division] ?? DIVISION_ALIASES[division.toUpperCase()] ?? 'OTHER';
}

/**
 * A row of `GET /v1/church-groups/members` — the 양육 screen's scoped member
 * list (TrainingMatrixMemberDto): no contact, account or ministry data.
 */
export interface TrainingMatrixMember extends MemberStageInput {
  publicId: string;
  lastName: string;
  firstName: string;
  baptism: Baptism | null;
  groupPublicId?: string | null;
  groupName?: string | null;
  trainings?: SummaryTraining[];
  isNextGroupLeader?: boolean;
  oneOnOneSignupFilled?: boolean;
  isGroupLeader?: boolean;
  groupLeaderSince?: string | null;
}

/** The server's page cap for the matrix list. */
const MATRIX_PAGE_SIZE = 10000;

export interface MatrixCell {
  publicId: string;
  displayName: string;
  category: MemberCategory;
}

export interface GroupColumn {
  publicId: string;
  division: string | null;
  name: string;
  leader: string;
  members: MatrixCell[];
}

export interface DivisionGroup {
  /** Stable key: the kind, or `OTHER:<division>` for an unknown division. */
  key: string;
  kind: DivisionKind;
  /** The division as stored. */
  division: string;
  groups: GroupColumn[];
}

export interface ChurchGroupMatrix {
  divisions: DivisionGroup[];
  rowCount: number;
}

@Injectable({ providedIn: 'root' })
export class ChurchGroupsService {
  private readonly api             = inject(ApiService);
  private readonly trainingCatalog = inject(TrainingCatalogService);

  /**
   * The 양육 endpoints (`TrainingMatrixController`) rather than the administrative
   * `/v1/members`, so the 양육팀 roles can read the screen (#214, #234). The list
   * holds ACTIVE members only.
   */
  loadDashboardData(): Observable<{
    members: TrainingMatrixMember[];
    groups: ChurchGroupSummary[];
  }> {
    return forkJoin({
      members: this.api
        .get<PageResponse<TrainingMatrixMember>>('/v1/church-groups/members', { page: 0, size: MATRIX_PAGE_SIZE })
        .pipe(map(p => p.content)),
      groups: this.api.get<ChurchGroupSummary[]>('/v1/church-groups'),
      // Categories are keyed on catalog codes, so the catalog has to be in before
      // the matrix is built.
      catalog: this.trainingCatalog.load(),
    }).pipe(map(({ members, groups }) => ({ members, groups })));
  }

  /**
   * The member's matrix category. The rule itself lives in
   * `core/models/member-stage.ts` — the 청년 list renders the same eight buckets
   * as MemberPills (#53), and one business rule may only exist once.
   */
  computeCategory(member: MemberStageInput): MemberCategory {
    return CATEGORY_BY_STAGE[memberPillStage(member, this.trainingCatalog.entries())];
  }

  buildMatrix(
    members: TrainingMatrixMember[],
    groups: ChurchGroupSummary[],
  ): ChurchGroupMatrix {
    const toCell = (m: TrainingMatrixMember): MatrixCell => ({
      publicId: m.publicId,
      displayName: m.lastName + m.firstName,
      category: this.computeCategory(m),
    });

    const leaderOf = (group: ChurchGroupSummary): string => {
      if (group.leaderName) return group.leaderName;
      const leader = members.find(
        m => m.groupPublicId === group.publicId && m.isGroupLeader,
      );
      return leader ? leader.lastName + leader.firstName : '';
    };

    // Every column comes from the church_groups table — including 새가족.
    const columns = new Map<string, GroupColumn>();
    for (const g of groups) {
      columns.set(g.publicId, {
        publicId: g.publicId,
        division: g.division,
        name: g.name,
        leader: leaderOf(g),
        members: [],
      });
    }

    // 새가족 doubles as the catch-all for any member with no (valid) group.
    // Members should always have a group, so this is a safety net only.
    const newcomersColumn = Array.from(columns.values()).find(
      c => divisionKind(c) === 'NEWCOMERS',
    );
    for (const m of members) {
      if (m.isGroupLeader) continue;
      const column =
        (m.groupPublicId && columns.get(m.groupPublicId)) || newcomersColumn;
      column?.members.push(toCell(m));
    }

    const divisions: DivisionGroup[] = [];
    const divIndex = new Map<string, DivisionGroup>();
    for (const col of columns.values()) {
      const kind = divisionKind(col);
      const key = kind === 'OTHER' ? `OTHER:${col.division ?? ''}` : kind;
      let group = divIndex.get(key);
      if (!group) {
        group = { key, kind, division: col.division ?? '', groups: [] };
        divIndex.set(key, group);
        divisions.push(group);
      }
      group.groups.push(col);
    }

    // Array.prototype.sort is stable: unknown divisions keep the server's order.
    divisions.sort((a, b) => DIVISION_RANK[a.kind] - DIVISION_RANK[b.kind]);

    const columnLengths = Array.from(columns.values()).map(c => c.members.length);
    const rowCount = Math.max(0, ...columnLengths);

    return { divisions, rowCount };
  }

  /** Sets or clears 예비순장 — the 양육 write, open to `training_editor` (#214). */
  setNextGroupLeader(publicId: string, isNextGroupLeader: boolean): Observable<void> {
    return this.api
      .patch<unknown>(`/v1/church-groups/members/${publicId}/next-leader`, { isNextGroupLeader })
      .pipe(map(() => undefined));
  }
}
