import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { MemberService } from '../members/member.service';
import { MemberSummary, ChurchGroupSummary } from '../../core/models/member.model';
import { SummaryTraining } from '../../core/models/member-activity.model';

export type MemberCategory =
  | 'NEXT_LEADER'
  | 'ONE_ON_ONE_IN_PROGRESS'
  | 'ONE_ON_ONE_WAITING'
  | 'QBS_COMPLETED'
  | 'DISCIPLESHIP_COMPLETED'
  | 'UNBAPTIZED'
  | 'DEFAULT';

export interface CategoryConfig {
  label: string;
  color: string;
}

export const CATEGORY_CONFIG: Record<MemberCategory, CategoryConfig> = {
  NEXT_LEADER:            { label: '예비순장',         color: '#f9a8d4' },
  ONE_ON_ONE_IN_PROGRESS: { label: '일대일진행',       color: '#bbf7d0' },
  ONE_ON_ONE_WAITING:     { label: '일대일대기',       color: '#fef08a' },
  QBS_COMPLETED:          { label: '큐비세수료',       color: '#bae6fd' },
  DISCIPLESHIP_COMPLETED: { label: '제자반수료',       color: '#ffffff' },
  UNBAPTIZED:             { label: '세례X / 확인대상', color: '#fed7aa' },
  DEFAULT:                { label: '',                 color: '#f9fafb' },
};

export const FILTER_CATEGORIES: MemberCategory[] = [
  'NEXT_LEADER',
  'ONE_ON_ONE_IN_PROGRESS',
  'ONE_ON_ONE_WAITING',
  'QBS_COMPLETED',
  'DISCIPLESHIP_COMPLETED',
  'UNBAPTIZED',
];

/**
 * Left-to-right order of divisions in the matrix. Divisions not listed here
 * keep their incoming (division-name) order and render after the listed ones.
 */
export const DIVISION_ORDER: readonly string[] = ['NEHEMIA', 'DANIEL'];

export interface MatrixCell {
  publicId: string;
  displayName: string;
  category: MemberCategory;
  isNextGroupLeader: boolean;
  oneOnOneSignupFilled: boolean;
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
  newcomers: MatrixCell[];
  rowCount: number;
}

@Injectable({ providedIn: 'root' })
export class ChurchGroupsService {
  private readonly memberService = inject(MemberService);

  loadDashboardData(): Observable<{ members: MemberSummary[]; groups: ChurchGroupSummary[] }> {
    return forkJoin({
      members: this.memberService
        .getMembers({ status: 'ACTIVE', size: 9999 })
        .pipe(map(p => p.content)),
      groups: this.memberService.getChurchGroups(),
    });
  }

  computeCategory(member: MemberSummary): MemberCategory {
    if (member.isNextGroupLeader) return 'NEXT_LEADER';

    const trainings: SummaryTraining[] = member.trainings ?? [];
    const has = (name: string, status: string): boolean =>
      trainings.some(
        t => t.name.toLowerCase().includes(name.toLowerCase()) && t.status === status,
      );

    if (has('1on1', 'IN_PROGRESS')) return 'ONE_ON_ONE_IN_PROGRESS';
    if (has('qtbs', 'COMPLETED') && member.oneOnOneSignupFilled) return 'ONE_ON_ONE_WAITING';
    if (has('qtbs', 'COMPLETED')) return 'QBS_COMPLETED';
    if (has('discipleship', 'COMPLETED')) return 'DISCIPLESHIP_COMPLETED';
    if (!member.baptism || member.baptism === 'UNBAPTIZED') return 'UNBAPTIZED';
    return 'DEFAULT';
  }

  buildMatrix(members: MemberSummary[], groups: ChurchGroupSummary[]): ChurchGroupMatrix {
    const toCell = (m: MemberSummary): MatrixCell => ({
      publicId: m.publicId,
      displayName: m.lastName + m.firstName,
      category: this.computeCategory(m),
      isNextGroupLeader: m.isNextGroupLeader ?? false,
      oneOnOneSignupFilled: m.oneOnOneSignupFilled ?? false,
    });

    const leaderOf = (groupPublicId: string): string => {
      const leader = members.find(
        m => m.groupPublicId === groupPublicId && m.churchRole === '순장',
      );
      return leader ? leader.lastName + leader.firstName : '';
    };

    const columns = new Map<string, GroupColumn>();
    for (const g of groups) {
      // Groups without a division (e.g. 새가족) are not real 순 columns — their
      // members fall into the 새가족순 newcomers column below.
      if (!g.division) continue;
      columns.set(g.publicId, {
        publicId: g.publicId,
        division: g.division,
        name: g.name,
        leader: leaderOf(g.publicId),
        members: [],
      });
    }

    const newcomers: MatrixCell[] = [];
    for (const m of members) {
      const cell = toCell(m);
      if (m.groupPublicId && columns.has(m.groupPublicId)) {
        columns.get(m.groupPublicId)!.members.push(cell);
      } else {
        newcomers.push(cell);
      }
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
      const i = DIVISION_ORDER.indexOf(division);
      return i === -1 ? DIVISION_ORDER.length : i;
    };
    divisions.sort((a, b) => rank(a.division) - rank(b.division));

    const columnLengths = Array.from(columns.values()).map(c => c.members.length);
    const rowCount = Math.max(0, ...columnLengths, newcomers.length);

    return { divisions, newcomers, rowCount };
  }

  patchMemberFlags(
    publicId: string,
    patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean },
  ): Observable<void> {
    return this.memberService.updateMember(publicId, patch).pipe(map(() => undefined));
  }
}
