import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';
import { LongAbsence, LongAbsenceHistoryItem, urgencyLevel } from '../../../core/models/long-absent.model';
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
import { actorName, contactActor, displayName, formatDay, formatInstant } from './long-absent-format';
import { LongAbsentHistoryPanelComponent } from './long-absent-history-panel.component';
import { LongAbsentHistoryState } from './long-absent-history-state.service';
import { LongAbsentMemoDialogComponent } from './long-absent-memo-dialog.component';
import { LongAbsentPhaseState, LongAbsentPhaseTarget } from './long-absent-phase-state.service';
import { LongAbsentReturnDialogComponent } from './long-absent-return-dialog.component';
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
 * 장기결석자 tab of 통계 (#277, #279) — Figma (#279) Desktop 1989:183279 / 1989:183953,
 * Tablet 1992:184822 / 1992:185249, Phone 1992:185086 / 1992:185507.
 *
 * #279 adds 복귀 (manual return, confirmation only), the history of closed
 * phases below the current list and the 이력 panel of one phase.
 *
 * One table with filter chips (전체 · 미연락 · 연락함, default 미연락); the
 * urgency badge carries colour and text. Below the desktop breakpoint every row
 * becomes a card with its actions underneath. The list and any memo draft live
 * only while this page is open.
 */
@Component({
  selector: 'app-long-absent-page',
  standalone: true,
  providers: [LongAbsentState, LongAbsentHistoryState, LongAbsentPhaseState, AnalyticsSummaryState, MessageService],
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    ButtonModule,
    PaginatorModule,
    ToastModule,
    TooltipModule,
    AnalyticsTabsComponent,
    BadgeComponent,
    DataCellDirective,
    DataTableComponent,
    EmptyStateComponent,
    LongAbsentHistoryPanelComponent,
    LongAbsentMemoDialogComponent,
    LongAbsentReturnDialogComponent,
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
  readonly history = inject(LongAbsentHistoryState);
  readonly phase = inject(LongAbsentPhaseState);
  private readonly roles = inject(RoleService);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  readonly breakpoint = inject(BreakpointService);

  private readonly lang = toSignal(this.translate.onLangChange);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('listHeading');

  readonly canWrite = computed(() => this.roles.canWrite('analytics'));
  readonly forbidden = computed(
    () =>
      this.state.status() === 'forbidden' ||
      this.summary.forbidden() ||
      this.history.status() === 'forbidden' ||
      this.phase.status() === 'forbidden',
  );

  /** The row whose memo is being edited, and the row whose contact is being undone. */
  readonly memoRow = signal<LongAbsence | null>(null);
  readonly undoRow = signal<LongAbsence | null>(null);
  readonly returnRow = signal<LongAbsence | null>(null);
  readonly dialogSaving = signal(false);
  /** 409 inside the memo or undo dialog: the draft stays to copy, saving is off. */
  readonly dialogConflict = signal(false);
  /** Where focus goes back to when a dialog closes. */
  private trigger: HTMLElement | null = null;

  constructor() {
    this.state.load();
    this.summary.load();
    this.history.load();
    this.state.refreshFailed$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.toast('warn', 'refreshFailed'));
    this.phase.forbidden$.pipe(takeUntilDestroyed()).subscribe(() => this.revokeAll());
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
      { type: 'custom', key: 'name', header: header('name'), width: '180px', sortable: false },
      { type: 'text', key: 'group', header: header('group'), width: '130px', sortable: false },
      { type: 'date', key: 'lastSunday', header: header('lastSunday'), width: '120px', sortable: false },
      { type: 'custom', key: 'absence', header: header('absence'), width: '160px', sortable: false },
      { type: 'custom', key: 'contact', header: header('contact'), width: '280px', sortable: false },
      { type: 'custom', key: 'memo', header: header('memo'), width: '250px', sortable: false },
      { type: 'custom', key: 'actions', header: header('actions'), width: '150px', sortable: false },
    ];
  });

  readonly historyColumns = computed<DataColumn[]>(() => {
    this.lang();
    const header = (key: string) => this.translate.instant(`statistics.longAbsent.history.columns.${key}`);
    return [
      { type: 'custom', key: 'name', header: header('name'), width: '180px', sortable: false },
      { type: 'text', key: 'period', header: header('period'), width: '220px', sortable: false },
      { type: 'custom', key: 'end', header: header('end'), width: '280px', sortable: false },
      { type: 'text', key: 'contact', header: header('contact'), width: '280px', sortable: false },
      { type: 'custom', key: 'actions', header: header('actions'), width: '120px', sortable: false },
    ];
  });

  readonly historyRecords = computed<DataRecord[]>(() => {
    this.lang();
    return this.history.items().map(item => ({
      id: item.phasePublicId,
      title: displayName(item),
      cells: { period: this.historyPeriod(item), contact: this.historyContact(item) },
    }));
  });

  private readonly historyById = computed(
    () => new Map(this.history.items().map(item => [item.phasePublicId, item] as const)),
  );

  historyItemOf(record: DataRecord): LongAbsenceHistoryItem | undefined {
    return this.historyById().get(record.id);
  }

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

  onHistoryPage(event: PaginatorState): void {
    this.history.load(event.page ?? 0);
  }

  // --- presentation ---------------------------------------------------------

  displayName(row: Pick<LongAbsence, 'fullName' | 'discriminator'>): string {
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

  historyPeriod(item: LongAbsenceHistoryItem): string {
    return `${this.day(item.absentSince)} – ${this.day(item.endedOn)}`;
  }

  historyEnd(item: LongAbsenceHistoryItem): string {
    this.lang();
    return this.translate.instant(`statistics.longAbsent.history.endReason.${item.endReason}`);
  }

  /** Who marked the return and when; empty for a check-in. */
  historyReturnedBy(item: LongAbsenceHistoryItem): string | null {
    this.lang();
    if (!item.returnedAt) return null;
    const who = actorName(item.returnedByMember, item.returnedBy) ?? this.translate.instant('statistics.longAbsent.unknownActor');
    return `${who} · ${formatInstant(item.returnedAt, this.locale())}`;
  }

  historyContact(item: LongAbsenceHistoryItem): string {
    this.lang();
    if (!item.contacted) return this.translate.instant('statistics.longAbsent.notContacted');
    const who = actorName(item.contactedByMember, item.contactedBy) ?? this.translate.instant('statistics.longAbsent.unknownActor');
    const at = item.contactedAt ? ` · ${formatInstant(item.contactedAt, this.locale())}` : '';
    return `${this.translate.instant('statistics.longAbsent.contacted')} · ${who}${at}`;
  }

  private locale(): string {
    return this.translate.getCurrentLang() === 'en' ? 'en-US' : 'ko-KR';
  }

  // --- actions ----------------------------------------------------------------

  markContacted(row: LongAbsence): void {
    if (!this.canWrite()) return;
    this.run(this.state.setContacted(row, true), 'contacted', row);
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
    this.run(this.state.setContacted(row, false, memoUpdate), 'undone', row, true);
  }

  openMemo(row: LongAbsence, event: Event): void {
    if (!this.canWrite() || this.state.isBusy(row)) return;
    this.trigger = event.currentTarget as HTMLElement | null;
    this.memoRow.set(row);
  }

  saveMemo(memo: string | null): void {
    const row = this.memoRow();
    if (!row) return;
    this.run(this.state.setMemo(row, memo), 'memoSaved', row, true);
  }

  openReturn(row: LongAbsence, event: Event): void {
    if (!this.canWrite() || this.state.isBusy(row)) return;
    this.trigger = event.currentTarget as HTMLElement | null;
    this.returnRow.set(row);
  }

  confirmReturn(): void {
    const row = this.returnRow();
    if (!row) return;
    this.run(this.state.markReturned(row), 'returned', row, true);
  }

  /** 이력 of the current phase; only once the server has stored it. */
  openCurrentHistory(row: LongAbsence, event: Event): void {
    if (!row.phasePublicId) return;
    this.openPanel({ memberPublicId: row.memberPublicId, phasePublicId: row.phasePublicId, fullName: displayName(row) }, event);
  }

  openPastHistory(item: LongAbsenceHistoryItem, event: Event): void {
    this.openPanel({ memberPublicId: item.memberPublicId, phasePublicId: item.phasePublicId, fullName: displayName(item) }, event);
  }

  closePanel(): void {
    this.phase.close();
    this.restoreFocus();
  }

  closeDialogs(): void {
    if (this.dialogSaving()) return;
    this.memoRow.set(null);
    this.undoRow.set(null);
    this.returnRow.set(null);
    this.dialogConflict.set(false);
    this.restoreFocus();
  }

  private openPanel(target: LongAbsentPhaseTarget, event: Event): void {
    this.trigger = event.currentTarget as HTMLElement | null;
    this.phase.open(target);
  }

  /** A 403 anywhere: forget every person, phase and memo on the page. */
  private revokeAll(): void {
    this.state.revoke();
    this.summary.revoke();
    this.history.revoke();
    this.phase.revoke();
    this.memoRow.set(null);
    this.undoRow.set(null);
    this.returnRow.set(null);
  }

  /**
   * A failed save keeps the dialog and its draft for a deliberate retry. A 409
   * from the memo or undo dialog keeps the draft visible to copy, with saving
   * off (#279 AK 5) — it is never sent into the newer phase. Every other
   * outcome closes the dialog. After any change the summary, the history and
   * an open 이력 panel of the same person read fresh from the server.
   */
  private run(request: Observable<LongAbsentWriteResult>, savedKey: string, row: LongAbsence, fromDialog = false): void {
    const keepsDraft = this.memoRow() !== null || this.undoRow() !== null;
    if (fromDialog) this.dialogSaving.set(true);
    request.subscribe({ complete: () => this.dialogSaving.set(false), next: result => {
      this.dialogSaving.set(false);
      if (result === 'saved') {
        this.toast('success', savedKey);
      } else {
        const { severity, key } = RESULT_TOASTS[result];
        this.toast(severity, key);
      }
      if (result === 'forbidden') {
        this.revokeAll();
        return;
      }
      if (result !== 'failed') {
        this.summary.load();
        this.history.reload();
        this.phase.refreshFor(row.memberPublicId);
      }
      if (!fromDialog || result === 'failed') return;
      if (result === 'conflict' && keepsDraft) this.dialogConflict.set(true);
      else this.closeDialogs();
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
