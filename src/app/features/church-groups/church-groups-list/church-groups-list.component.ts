import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { ChurchGroupSummary } from '../../../core/models/member.model';
import { RoleService } from '../../../core/services/role.service';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { MemberPillComponent } from '../../../core/ui/member-pill/member-pill.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SegmentOption, SegmentedControlComponent } from '../../../core/ui/segmented-control/segmented-control.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import {
  TrainingTableCell,
  TrainingTableComponent,
  TrainingTableDivision,
} from '../../../core/ui/training-table/training-table.component';
import { MEMBER_PILL_STAGES, MemberPillStage } from '../../../core/ui/variant-tokens';
import {
  ChurchGroupMatrix,
  ChurchGroupsService,
  DivisionGroup,
  GroupColumn,
  MatrixCell,
  STAGE_BY_CATEGORY,
  TrainingMatrixMember,
} from '../church-groups.service';

/** Divisions with a translated name. */
const TRANSLATED_DIVISIONS: ReadonlySet<string> = new Set(['NEHEMIA', 'DANIEL', 'NEWCOMERS']);

/** The 순장 row is marked 제자반수료 by default (Figma 215:7645, #234). */
const LEADER_STAGE: MemberPillStage = 'discipleship';

export interface StageChip {
  stage: MemberPillStage;
  label: string;
  count: number;
}

/**
 * 양육 (#57, named 순 until #214, table since #234) — Figma 05 · 양육 (930:95171):
 * Desktop 215:7645, Tablet 762:47957, Phone 734:38582, 예비순장 filter 218:7765.
 *
 * The 순 are one table in the layout of the paper 양육 list: 느헤미야, 다니엘,
 * 새가족순 at the right end. Desktop shows every division; tablet and phone show
 * one at a time behind a 느헤미야 / 다니엘 / 새가족순 switch.
 *
 * The stage filter is single-select and lives in `?stage=` so a filtered view can
 * be shared. Filtering never hides a member: non-matching cells are greyed out.
 * With 예비순장 active, 제자반수료 cells become dashed candidates and a click
 * sets or clears 예비순장 — only for a role that may write 양육 (#214); everyone
 * else gets the plain filter. Chip counts and the hint count every division.
 */
@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [
    NgTemplateOutlet, TranslatePipe, ToastModule,
    EmptyStateComponent, FilterChipComponent, MemberPillComponent, PageHeaderComponent,
    SegmentedControlComponent, SkeletonComponent, TrainingTableComponent,
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
  private readonly roles = inject(RoleService);

  /** desktop: one table · tablet: switch, chips 4 × 2 · phone: switch, chips 3 × 3. */
  readonly layout = inject(BreakpointService).current;

  readonly canWrite = computed(() => this.roles.canWrite('churchGroups'));

  /** Recomputes the translated labels when the language changes. */
  private readonly lang = toSignal(this.translate.onLangChange);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  readonly loading = signal(true);

  private readonly members = signal<TrainingMatrixMember[]>([]);
  private readonly groups = signal<ChurchGroupSummary[]>([]);

  /** The division picked in the tablet/phone switch; empty = the first one. */
  readonly selectedDivision = signal('');

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

  /** 예비순장 active for a writer: 제자반수료 cells can be promoted, 예비순장 cells cleared. */
  readonly assignMode = computed(() => this.stageFilter() === 'next-leader' && this.canWrite());

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
    const key = this.assignMode() ? 'groups.hint.assign' : 'groups.hint.filter';
    return this.translate.instant(key, { stage: chip.label, count: chip.count });
  });

  /** Every division as a table block, left to right. */
  readonly divisions = computed<TrainingTableDivision[]>(() => {
    this.lang();
    return this.matrix().divisions.map(d => ({
      key: d.key,
      heading: this.divisionHeading(d),
      spanHeader: d.kind === 'NEWCOMERS',
      columns: d.groups.map(g => ({
        key: g.publicId,
        name: g.name,
        leader: this.leaderCell(g),
        cells: g.members.map(m => this.memberCell(m)),
      })),
    }));
  });

  readonly activeDivision = computed(() => {
    const keys = this.divisions().map(d => d.key);
    return keys.includes(this.selectedDivision()) ? this.selectedDivision() : (keys[0] ?? '');
  });

  readonly divisionOptions = computed<SegmentOption[]>(() => {
    this.lang();
    return this.matrix().divisions.map(d => ({
      value: d.key,
      label: this.divisionHeading(d),
    }));
  });

  readonly visibleDivisions = computed<TrainingTableDivision[]>(() =>
    this.layout() === 'desktop'
      ? this.divisions()
      : this.divisions().filter(d => d.key === this.activeDivision()),
  );

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

  onCellActivated(cell: TrainingTableCell): void {
    if (this.assignMode() && cell.interactive && cell.id) this.toggleNextLeader(cell.id);
  }

  /** Optimistic: flips 예비순장 at once and reverts with a toast if the PATCH fails. */
  toggleNextLeader(publicId: string): void {
    if (!this.canWrite()) return;
    const member = this.members().find(m => m.publicId === publicId);
    if (!member) return;
    const value = !member.isNextGroupLeader;
    this.setNextLeader(publicId, value);

    this.service.setNextGroupLeader(publicId, value)
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

  /** "느헤미야", "새가족순", or an unknown division as stored. */
  private divisionHeading(d: DivisionGroup): string {
    if (TRANSLATED_DIVISIONS.has(d.kind)) return this.translate.instant(`groups.division.${d.kind}`);
    return d.division || this.translate.instant('groups.division.none');
  }

  private leaderCell(group: GroupColumn): TrainingTableCell | null {
    if (!group.leader) return null;
    const filter = this.stageFilter();
    return {
      id: null,
      label: group.leader,
      stage: LEADER_STAGE,
      stageLabel: this.stageLabel(LEADER_STAGE),
      state: filter && filter !== LEADER_STAGE ? 'dimmed' : 'default',
      interactive: false,
    };
  }

  private memberCell(cell: MatrixCell): TrainingTableCell {
    const stage = STAGE_BY_CATEGORY[cell.category];
    const base = {
      id: cell.publicId,
      label: cell.displayName,
      stage,
      stageLabel: this.stageLabel(stage),
    };
    const filter = this.stageFilter();
    if (!filter) return { ...base, state: 'default', interactive: false };
    if (this.assignMode() && stage === 'discipleship') {
      return { ...base, state: 'candidate', interactive: true, actionLabel: this.action('assign', cell) };
    }
    if (stage === filter) {
      const assign = this.assignMode();
      return { ...base, state: 'default', interactive: assign, actionLabel: assign ? this.action('unassign', cell) : undefined };
    }
    return { ...base, state: 'dimmed', interactive: false };
  }

  private action(kind: 'assign' | 'unassign', cell: MatrixCell): string {
    return this.translate.instant(`groups.action.${kind}`, { name: cell.displayName });
  }

  private stageLabel(stage: MemberPillStage): string {
    return this.translate.instant(`groups.stage.${stage}`);
  }
}
