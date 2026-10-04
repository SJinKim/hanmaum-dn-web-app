import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { MemberSummary, ChurchGroupSummary } from '../../../core/models/member.model';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { GroupCardComponent, GroupCardMember } from '../../../core/ui/group-card/group-card.component';
import { MemberPillComponent } from '../../../core/ui/member-pill/member-pill.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { MEMBER_PILL_STAGES, MemberPillStage } from '../../../core/ui/variant-tokens';
import {
  ChurchGroupMatrix,
  ChurchGroupsService,
  GroupColumn,
  MatrixCell,
  STAGE_BY_CATEGORY,
} from '../church-groups.service';

/** Divisions with a translated name; any other division shows its raw name (새가족). */
const NAMED_DIVISIONS: ReadonlySet<string> = new Set(['DANIEL', 'NEHEMIA']);

export interface StageChip {
  stage: MemberPillStage;
  label: string;
  count: number;
}

export interface GroupCardView {
  publicId: string;
  name: string;
  leader: string;
  members: GroupCardMember[];
  /** Members matching the active stage filter; undefined without a filter. */
  matchCount?: number;
}

export interface DivisionView {
  key: string;
  heading: string;
  caption: string;
  cards: GroupCardView[];
}

/**
 * 순 (#57) — Figma: Desktop 215:7645, 예비순장 filter 218:7765, Phone 734:38582.
 *
 * One GroupCard per 순, grouped by division. The stage filter is single-select
 * and lives in `?stage=` so a filtered view can be shared. Filtering never hides
 * a member: non-matching pills are dimmed. With 예비순장 active, 제자반수료
 * pills become dashed candidates and a click sets or clears 예비순장.
 */
@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [
    TranslatePipe, ToastModule,
    EmptyStateComponent, FilterChipComponent, GroupCardComponent, MemberPillComponent,
    PageHeaderComponent, SkeletonComponent,
  ],
  providers: [MessageService],
  templateUrl: './church-groups-list.component.html',
})
export class ChurchGroupsListComponent implements OnInit {
  private readonly service = inject(ChurchGroupsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);

  /** Recomputes the translated labels when the language changes. */
  private readonly lang = toSignal(this.translate.onLangChange);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly loading = signal(true);

  private readonly members = signal<MemberSummary[]>([]);
  private readonly groups = signal<ChurchGroupSummary[]>([]);
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  readonly matrix = computed<ChurchGroupMatrix>(() =>
    this.service.buildMatrix(this.members(), this.groups()),
  );

  private readonly cells = computed<MatrixCell[]>(() =>
    this.matrix().divisions.flatMap(d => d.groups.flatMap(g => g.members)),
  );

  readonly stageFilter = computed<MemberPillStage | null>(() => {
    const value = this.queryParams()?.get('stage');
    return value && (MEMBER_PILL_STAGES as readonly string[]).includes(value)
      ? (value as MemberPillStage)
      : null;
  });

  /** 예비순장 active: 제자반수료 pills can be promoted, 예비순장 pills cleared. */
  readonly assignMode = computed(() => this.stageFilter() === 'next-leader');

  readonly totalMembers = computed(() => this.cells().length);
  readonly groupCount = computed(() =>
    this.matrix().divisions.reduce((sum, d) => sum + d.groups.length, 0),
  );

  readonly stageChips = computed<StageChip[]>(() => {
    this.lang();
    const counts = new Map<MemberPillStage, number>();
    for (const cell of this.cells()) {
      const stage = STAGE_BY_CATEGORY[cell.category];
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    return MEMBER_PILL_STAGES.map(stage => ({
      stage,
      label: this.stageLabel(stage),
      count: counts.get(stage) ?? 0,
    }));
  });

  readonly filterHint = computed<string | null>(() => {
    const stage = this.stageFilter();
    if (!stage) return null;
    const chip = this.stageChips().find(c => c.stage === stage)!;
    const key = stage === 'next-leader' ? 'groups.hint.assign' : 'groups.hint.filter';
    return this.translate.instant(key, { stage: chip.label, count: chip.count });
  });

  readonly divisions = computed<DivisionView[]>(() => {
    this.lang();
    return this.matrix().divisions.map(d => ({
      key: d.division,
      heading: NAMED_DIVISIONS.has(d.division)
        ? this.translate.instant('groups.divisionHeading', {
          name: this.translate.instant(`groups.division.${d.division}`),
        })
        : d.division || this.translate.instant('groups.division.none'),
      caption: this.translate.instant('groups.divisionCaption', {
        groups: d.groups.length,
        members: d.groups.reduce((sum, g) => sum + g.members.length, 0),
      }),
      cards: d.groups.map(g => this.toCard(g)),
    }));
  });

  readonly allCollapsed = computed(() => {
    const ids = this.matrix().divisions.flatMap(d => d.groups.map(g => g.publicId));
    return ids.length > 0 && ids.every(id => this.collapsed().has(id));
  });

  ngOnInit(): void {
    this.service
      .loadDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, groups }) => {
          this.members.set(members);
          this.groups.set(groups);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  /** Selects a stage; the active stage again or `null` (전체) clears the filter. */
  selectStage(stage: MemberPillStage | null): void {
    const next = stage === this.stageFilter() ? null : stage;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { stage: next },
      queryParamsHandling: 'merge',
    });
  }

  isExpanded(publicId: string): boolean {
    return !this.collapsed().has(publicId);
  }

  setExpanded(publicId: string, expanded: boolean): void {
    this.collapsed.update(current => {
      const next = new Set(current);
      if (expanded) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  toggleAll(): void {
    this.collapsed.set(this.allCollapsed()
      ? new Set()
      : new Set(this.matrix().divisions.flatMap(d => d.groups.map(g => g.publicId))));
  }

  onMemberClicked(member: GroupCardMember): void {
    if (this.assignMode() && member.id) this.toggleNextLeader(member.id);
  }

  /** Optimistic: flips 예비순장 at once and reverts with a toast if the PATCH fails. */
  toggleNextLeader(publicId: string): void {
    const member = this.members().find(m => m.publicId === publicId);
    if (!member) return;
    const value = !member.isNextGroupLeader;
    this.setNextLeader(publicId, value);

    this.service.patchMemberFlags(publicId, { isNextGroupLeader: value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          this.setNextLeader(publicId, !value);
          this.messages.add({
            severity: 'error',
            summary: this.translate.instant('groups.saveFailed'),
          });
        },
      });
  }

  private setNextLeader(publicId: string, value: boolean): void {
    this.members.update(ms =>
      ms.map(m => m.publicId === publicId ? { ...m, isNextGroupLeader: value } : m),
    );
  }

  private toCard(group: GroupColumn): GroupCardView {
    const filter = this.stageFilter();
    const assign = this.assignMode();
    const members = group.members.map((cell): GroupCardMember => {
      const stage = STAGE_BY_CATEGORY[cell.category];
      const base = { id: cell.publicId, label: cell.displayName, stage, stageLabel: this.stageLabel(stage) };
      if (!filter) return base;
      if (assign && stage === 'discipleship') return { ...base, state: 'candidate', interactive: true };
      if (stage === filter) return { ...base, interactive: assign };
      return { ...base, state: 'dimmed' };
    });
    return {
      publicId: group.publicId,
      name: group.name,
      leader: group.leader,
      members,
      matchCount: filter ? members.filter(m => m.stage === filter).length : undefined,
    };
  }

  private stageLabel(stage: MemberPillStage): string {
    return this.translate.instant(`groups.stage.${stage}`);
  }
}
