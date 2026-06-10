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
  UNBAPTIZED:             { label: '세레X / 확인대상', color: '#fed7aa' },
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

export interface MatrixCell {
  publicId: string;
  displayName: string;
  category: MemberCategory;
  isNextGroupLeader: boolean;
  oneOnOneSignupFilled: boolean;
}

export type MatrixRow = Record<string, MatrixCell | null>;

export const NEWCOMERS_KEY = 'grp_newcomers';

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

  buildMatrix(members: MemberSummary[], groups: ChurchGroupSummary[]): MatrixRow[] {
    const groupMap = new Map<string, MatrixCell[]>();
    for (const g of groups) groupMap.set(g.publicId, []);

    const newcomers: MatrixCell[] = [];

    for (const m of members) {
      const cell: MatrixCell = {
        publicId: m.publicId,
        displayName: m.lastName + m.firstName,
        category: this.computeCategory(m),
        isNextGroupLeader: m.isNextGroupLeader ?? false,
        oneOnOneSignupFilled: m.oneOnOneSignupFilled ?? false,
      };
      if (m.groupPublicId && groupMap.has(m.groupPublicId)) {
        groupMap.get(m.groupPublicId)!.push(cell);
      } else {
        newcomers.push(cell);
      }
    }

    const groupMaxLen = Math.max(0, ...Array.from(groupMap.values()).map(a => a.length));
    const totalRows = Math.max(groupMaxLen, newcomers.length);

    const rows: MatrixRow[] = [];
    for (let i = 0; i < totalRows; i++) {
      const row: MatrixRow = {};
      for (const [pubId, cells] of groupMap) {
        row[`grp_${pubId}`] = cells[i] ?? null;
      }
      row[NEWCOMERS_KEY] = newcomers[i] ?? null;
      rows.push(row);
    }
    return rows;
  }

  patchMemberFlags(
    publicId: string,
    patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean },
  ): Observable<void> {
    return this.memberService.updateMember(publicId, patch).pipe(map(() => undefined));
  }
}
