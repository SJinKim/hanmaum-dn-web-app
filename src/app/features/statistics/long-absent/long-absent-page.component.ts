import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';
import { LongAbsence, urgencyLevel } from '../../../core/models/long-absent.model';
import { RoleService } from '../../../core/services/role.service';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord, DataRecordBadge } from '../../../core/ui/data-record.model';
import { DataCellDirective } from '../../../core/ui/data-table/data-cell.directive';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import {
  SegmentOption,
  SegmentedControlComponent,
} from '../../../core/ui/segmented-control/segmented-control.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { AnalyticsSummaryState } from '../analytics-tabs/analytics-summary-state.service';
import { AnalyticsTabsComponent } from '../analytics-tabs/analytics-tabs.component';
import { contactActor, displayName, formatDay, formatInstant } from './long-absent-format';
import { LongAbsentMemoDialogComponent } from './long-absent-memo-dialog.component';
import { LongAbsentFilter, LongAbsentState, LongAbsentWriteResult } from './long-absent-state.service';
import { LongAbsentUndo, LongAbsentUndoDialogComponent } from './long-absent-undo-dialog.component';

const FILTERS: readonly LongAbsentFilter[] = ['all', 'open', 'done'];

/** Toast per write outcome; `saved` depends on the action. */
const RESULT_TOASTS: Record<Exclude<LongAbsentWriteResult, 'saved'>, { severity: string; key: string }> = {
  conflict: { severity: 'warn', key: 'conflict' },
  notFound: { severity: 'warn', key: 'notFound' },
  forbidden: { severity: 'error', key: 'forbidden' },
  failed: { severity: 'error', key: 'saveFailed' },
};

/**
 * 장기결석자 tab of 통계 (#277) — Figma Desktop 1956:177795 / 1956:177834,
 * Tablet 1960:181432 / 1961:181644, Phone 1960:181869 / 1961:181675.
 *
 * One table with filter chips (전체 · 미연락 · 연락함, default 미연락); the
 * urgency badge carries colour and text. Below the desktop breakpoint every row
 * becomes a card with its actions underneath. The list and any memo draft live
 * only while this page is open.
 */
@Component({
  selector: 'app-long-absent-page',
  standalone: true,
  providers: [LongAbsentState, AnalyticsSummaryState, MessageService],
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    ButtonModule,
    ToastModule,
    TooltipModule,
    AnalyticsTabsComponent,
    BadgeComponent,
    DataCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    LongAbsentMemoDialogComponent,
    LongAbsentUndoDialogComponent,
    PageHeaderComponent,
    SegmentedControlComponent,
    SkeletonComponent,
  ],
  templateUrl: './long-absent-page.component.html',
})
export class LongAbsentPageComponent {
  readonly state = inject(LongAbsentState);
  readonly summary = inject(AnalyticsSummaryState);
  private readonly roles = inject(RoleService);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  readonly breakpoint = inject(BreakpointService);

  private readonly lang = toSignal(this.translate.onLangChange);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('listHeading');

  readonly canWrite = computed(() => this.roles.canWrite('analytics'));
  readonly forbidden = computed(() => this.state.status() === 'forbidden' || this.summary.forbidden());

  /** The row whose memo is being edited, and the row whose contact is being undone. */
  readonly memoRow = signal<LongAbsence | null>(null);
  readonly undoRow = signal<LongAbsence | null>(null);
  readonly dialogSaving = signal(false);
  /** Where focus goes back to when a dialog closes. */
  private trigger: HTMLElement | null = null;

  constructor() {
    this.state.load();
    this.summary.load();
    this.state.refreshFailed$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.toast('warn', 'refreshFailed'));
  }

  readonly filterOptions = computed<SegmentOption[]>(() => {
    this.lang();
    const counts: Record<LongAbsentFilter, number> = {
      all: this.state.totalCount(),
      open: this.state.openCount(),
      done: this.state.doneCount(),
    };
    return FILTERS.map(filter => ({
      value: filter,
      label: this.translate.instant(`statistics.longAbsent.filter.${filter}`, { count: counts[filter] }),
    }));
  });

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const header = (key: string) => this.translate.instant(`statistics.longAbsent.columns.${key}`);
    return [
      { type: 'custom', key: 'name', header: header('name'), width: '200px', sortable: false },
      { type: 'text', key: 'group', header: header('group'), width: '140px', sortable: false },
      { type: 'date', key: 'lastSunday', header: header('lastSunday'), width: '130px', sortable: false },
      { type: 'custom', key: 'absence', header: header('absence'), width: '170px', sortable: false },
      { type: 'custom', key: 'contact', header: header('contact'), width: '220px', sortable: false },
      { type: 'custom', key: 'memo', header: header('memo'), width: '260px', sortable: false },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    this.lang();
    return this.state.visibleRows().map(row => ({
      id: row.memberPublicId,
      title: displayName(row),
      cells: { group: this.groupLabel(row), lastSunday: this.day(row.lastSundayDate) },
    }));
  });

  private readonly rowsById = computed(
    () => new Map(this.state.rows().map(row => [row.memberPublicId, row] as const)),
  );

  rowOf(record: DataRecord): LongAbsence | undefined {
    return this.rowsById().get(record.id);
  }

  onFilterChange(value: string): void {
    const filter = FILTERS.find(f => f === value);
    if (filter) this.state.setFilter(filter);
  }

  retry(): void {
    this.state.load();
    if (!this.summary.summary()) this.summary.load();
  }

  // --- presentation ---------------------------------------------------------

  displayName(row: LongAbsence): string {
    return displayName(row);
  }

  groupLabel(row: LongAbsence): string {
    return row.group?.name ?? this.translate.instant('statistics.longAbsent.noGroup');
  }

  urgencyBadge(row: LongAbsence): DataRecordBadge {
    this.lang();
    const level = urgencyLevel(row.absenceMonths);
    return {
      variant: `urgency-${level}`,
      label: this.translate.instant('statistics.longAbsent.badge', { months: row.absenceMonths, level }),
    };
  }

  day(value: string): string {
    return formatDay(value, this.locale());
  }

  contactLine(row: LongAbsence): string {
    this.lang();
    const actor = contactActor(row) ?? this.translate.instant('statistics.longAbsent.unknownActor');
    const at = row.contactedAt ? formatInstant(row.contactedAt, this.locale()) : null;
    return at ? `${actor} · ${at}` : actor;
  }

  private locale(): string {
    return this.translate.getCurrentLang() === 'en' ? 'en-US' : 'ko-KR';
  }

  // --- actions ----------------------------------------------------------------

  markContacted(row: LongAbsence): void {
    if (!this.canWrite()) return;
    this.run(this.state.setContacted(row, true), 'contacted');
  }

  openUndo(row: LongAbsence, event: Event): void {
    if (!this.canWrite() || this.state.isBusy(row)) return;
    this.trigger = event.currentTarget as HTMLElement | null;
    this.undoRow.set(row);
  }

  confirmUndo(undo: LongAbsentUndo): void {
    const row = this.undoRow();
    if (!row) return;
    const memoUpdate = undo.memo === null ? undefined : { value: undo.memo };
    this.run(this.state.setContacted(row, false, memoUpdate), 'undone', true);
  }

  openMemo(row: LongAbsence, event: Event): void {
    if (!this.canWrite() || this.state.isBusy(row)) return;
    this.trigger = event.currentTarget as HTMLElement | null;
    this.memoRow.set(row);
  }

  saveMemo(memo: string | null): void {
    const row = this.memoRow();
    if (!row) return;
    this.run(this.state.setMemo(row, memo), 'memoSaved', true);
  }

  closeDialogs(): void {
    if (this.dialogSaving()) return;
    this.memoRow.set(null);
    this.undoRow.set(null);
    this.restoreFocus();
  }

  /**
   * A failed save keeps the dialog and its draft for a deliberate retry; every
   * other outcome closes it. 409/404 also mean the draft belongs to a phase
   * that is gone, so it is dropped rather than carried over.
   */
  private run(request: Observable<LongAbsentWriteResult>, savedKey: string, fromDialog = false): void {
    if (fromDialog) this.dialogSaving.set(true);
    request.subscribe({ complete: () => this.dialogSaving.set(false), next: result => {
      this.dialogSaving.set(false);
      if (result === 'saved') {
        this.toast('success', savedKey);
      } else {
        const { severity, key } = RESULT_TOASTS[result];
        this.toast(severity, key);
      }
      if (result === 'forbidden') this.summary.revoke();
      else if (result !== 'failed') this.summary.load();
      if (fromDialog && result !== 'failed') this.closeDialogs();
    } });
  }

  private restoreFocus(): void {
    const target = this.trigger?.isConnected ? this.trigger : this.heading()?.nativeElement;
    this.trigger = null;
    setTimeout(() => target?.focus());
  }

  private toast(severity: string, key: string): void {
    this.messages.add({ severity, summary: this.translate.instant(`statistics.longAbsent.toast.${key}`) });
  }
}
