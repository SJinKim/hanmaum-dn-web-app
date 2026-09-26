import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { MemberService } from '../members/member.service';
import { TrainingCatalogService } from '../../core/services/training-catalog.service';
import { MemberSummary, ChurchGroupSummary } from '../../core/models/member.model';
import { memberPillStage } from '../../core/models/member-stage';
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
 * Order of divisions on the 순 page — 다니엘 before 느헤미야, as in Figma 215:7645.
 * Divisions not listed here keep their incoming (division-name) order and render after the listed ones.
 * The 새가족 division is intentionally absent so it always sorts last.
 */
export const DIVISION_ORDER: readonly string[] = ['DANIEL', 'NEHEMIA'];

/**
 * Name of the 새가족 group/division. It is an ordinary church_groups row, but
 * also acts as the catch-all column for any member that somehow has no group.
 */
export const NEWCOMERS_GROUP_NAME = '새가족';

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
  division: string;
  groups: GroupColumn[];
}

export interface ChurchGroupMatrix {
  divisions: DivisionGroup[];
  rowCount: number;
}

@Injectable({ providedIn: 'root' })
export class ChurchGroupsService {
  private readonly memberService    = inject(MemberService);
  private readonly trainingCatalog  = inject(TrainingCatalogService);

  loadDashboardData(): Observable<{
    members: MemberSummary[];
    groups: ChurchGroupSummary[];
  }> {
    return forkJoin({
      members: this.memberService
        .getMembers({ status: 'ACTIVE', size: 9999 })
        .pipe(map(p => p.content)),
      groups: this.memberService.getChurchGroups(),
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
  computeCategory(member: MemberSummary): MemberCategory {
    return CATEGORY_BY_STAGE[memberPillStage(member, this.trainingCatalog.entries())];
  }

  buildMatrix(
    members: MemberSummary[],
    groups: ChurchGroupSummary[],
  ): ChurchGroupMatrix {
    const toCell = (m: MemberSummary): MatrixCell => ({
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
      c => c.name === NEWCOMERS_GROUP_NAME,
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
      const key = col.division ?? '';
      let group = divIndex.get(key);
      if (!group) {
        group = { division: key, groups: [] };
        divIndex.set(key, group);
        divisions.push(group);
      }
      group.groups.push(col);
    }

    const rank = (division: string): number => {
      if (division === NEWCOMERS_GROUP_NAME) return Number.MAX_SAFE_INTEGER;
      const i = DIVISION_ORDER.indexOf(division);
      return i === -1 ? DIVISION_ORDER.length : i;
    };
    divisions.sort((a, b) => rank(a.division) - rank(b.division));

    const columnLengths = Array.from(columns.values()).map(c => c.members.length);
    const rowCount = Math.max(0, ...columnLengths);

    return { divisions, rowCount };
  }

  patchMemberFlags(
    publicId: string,
    patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean },
  ): Observable<void> {
    return this.memberService.updateMember(publicId, patch).pipe(map(() => undefined));
  }
}
