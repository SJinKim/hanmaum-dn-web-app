import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';

import { injectAppLang } from '../../../core/i18n/language';
import { RoleService } from '../../../core/services/role.service';
import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { DataColumn, DataRecord } from '../../../core/ui/data-record.model';
import { DataCellDirective } from '../../../core/ui/data-table/data-cell.directive';
import { DataTableComponent } from '../../../core/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { ListCardComponent } from '../../../core/ui/list-card/list-card.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { BULLETIN_STATUS_BADGE, BulletinEditionSummary, BulletinSundayOption, formatServiceDate } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';

export type CreateMode = 'copy' | 'blank';

/**
 * 주보 (#36) — Figma: 주보 · 목록. Newest Sunday first, as the server sorts.
 *
 * Figma #197: 새 주보 shows server-provided Sundays and preselects the earliest
 * free one. An existing edition is opened instead of duplicated.
 */
@Component({
  selector: 'app-bulletins-list',
  standalone: true,
  imports: [
    TranslatePipe, FormsModule, ButtonModule, ConfirmDialogModule, DialogModule,
    RadioButtonModule, SelectModule, TabsModule, ToastModule,
    DataCellDirective, DataTableComponent, EmptyStateComponent, ListCardComponent,
    PageHeaderComponent, SectionHeaderComponent, SkeletonComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './bulletins-list.component.html',
})
export class BulletinsListComponent implements OnInit {
  private readonly service    = inject(BulletinsService);
  private readonly messages   = inject(MessageService);
  private readonly confirm    = inject(ConfirmationService);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router     = inject(Router);
  private readonly roles      = inject(RoleService);
  private readonly lang       = injectAppLang();

  protected readonly isPhone  = inject(BreakpointService).isPhone;
  protected readonly canWrite = computed(() => this.roles.canWrite('bulletin'));

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly editions = signal<BulletinEditionSummary[]>([]);
  readonly total = signal(0);

  readonly createVisible = signal(false);
  readonly createMode = signal<CreateMode>('copy');
  readonly creating = signal(false);
  readonly datesLoading = signal(false);
  readonly datesFailed = signal(false);
  readonly selectedDate = signal<string | null>(null);
  readonly sundays = signal<BulletinSundayOption[]>([]);
  readonly nextFrom = signal<string | null>(null);
  private datesRequest?: Subscription;
  private requestedFrom?: string;
  private conflictDate: string | null = null;

  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
    content: { style: { paddingBottom: '0' } },
  };

  readonly sundaySelectPt = computed(() => {
    const labelColor = this.datesLoading() ? '!text-ink-disabled' : this.datesFailed() ? '!text-ink' : '!text-ink-muted';
    return {
      label: { class: `type-body-sm !text-xs !leading-4 ${labelColor}`, 'aria-describedby': 'bulletin-sunday-hint' },
      option: { class: 'type-body-sm !text-xs !leading-4' },
      dropdown: { style: { width: this.datesFailed() ? 'var(--space-48)' : 'var(--space-32)' } },
    };
  });

  readonly selectedSunday = computed(() => this.sundays().find(s => s.serviceDate === this.selectedDate()) ?? null);
  readonly dateOptions = computed(() => {
    this.lang();
    const sunday = this.translate.instant('bulletins.sunday') as string;
    return this.sundays().map(s => ({
      ...s,
      label: formatServiceDate(s.serviceDate, sunday) +
        (s.status ? ` · ${this.translate.instant(`bulletins.status.${s.status}`)}` : ''),
    }));
  });

  /** Copying always uses the newest edition in the server-sorted list. */
  readonly copySource = computed(() => this.editions()[0] ?? null);

  readonly subtitle = computed(() => {
    this.lang();
    return this.translate.instant('bulletins.subtitle', {
      total: this.total(),
      drafts: this.editions().filter(e => e.status === 'DRAFT').length,
    }) as string;
  });

  readonly columns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`bulletins.columns.${key}`) as string;
    return [
      { type: 'text', key: 'date', header: t('serviceDate'), tone: 'strong' },
      { type: 'text', key: 'volume', header: t('volume'), width: '120px' },
      { type: 'text', key: 'updated', header: t('updated'), width: '160px' },
      { type: 'badge', header: t('status'), width: '120px' },
      { type: 'custom', key: 'actions', header: t('actions'), width: '96px', align: 'end' },
    ];
  });

  readonly records = computed<DataRecord[]>(() => {
    this.lang();
    const sunday = this.translate.instant('bulletins.sunday') as string;
    return this.editions().map(e => {
      const date = formatServiceDate(e.serviceDate, sunday);
      const volume = this.volumeLabel(e);
      const updated = e.publishedAt ? e.publishedAt.slice(0, 10) : '—';
      return {
        id: e.publicId,
        title: date,
        subtitle: volume,
        meta: updated,
        badge: {
          variant: BULLETIN_STATUS_BADGE[e.status],
          label: this.translate.instant(`bulletins.status.${e.status}`) as string,
        },
        cells: { date, volume, updated },
      };
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service.list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.editions.set(page.content);
          this.total.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  /** Tab 1 is 설정, which lives on its own route (#194). */
  onTab(value: unknown): void {
    if (value === 1) void this.router.navigate(['/bulletins', 'settings']);
  }

  openEdit(id: string): void {
    void this.router.navigate(['/bulletins', id]);
  }

  /** Only a draft that never had a VOL can go; the server says 409 to the rest. */
  canDelete(id: string): boolean {
    const e = this.editions().find(x => x.publicId === id);
    return !!e && e.status === 'DRAFT' && e.volume === null;
  }

  openCreate(): void {
    this.createMode.set(this.copySource() ? 'copy' : 'blank');
    if (!this.canWrite()) return;
    this.datesRequest?.unsubscribe();
    this.conflictDate = null;
    this.selectedDate.set(null);
    this.sundays.set([]);
    this.nextFrom.set(null);
    this.createVisible.set(true);
    this.loadDates();
  }

  closeCreate(): void {
    if (this.creating()) return;
    this.datesRequest?.unsubscribe();
    this.conflictDate = null;
    this.datesLoading.set(false);
    this.createVisible.set(false);
  }

  loadDates(from?: string): void {
    this.datesRequest?.unsubscribe();
    this.requestedFrom = from;
    this.datesLoading.set(true);
    this.datesFailed.set(false);
    this.datesRequest = this.service.defaults(from)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: defaults => {
          const first = defaults.sundays[0]?.serviceDate;
          const advancedCursor = from && first && first > from ? first : null;
          // The server can advance a stale cursor after Berlin midnight. Drop expired cached dates.
          const retained = (from ? this.sundays() : []).filter(s => !advancedCursor || s.serviceDate >= advancedCursor);
          const options = new Map(retained.map(s => [s.serviceDate, s]));
          defaults.sundays.forEach(s => options.set(s.serviceDate, s));
          // A suggestion beyond this batch is still selectable; its date comes from the server.
          if (!options.has(defaults.serviceDate)) {
            options.set(defaults.serviceDate, { serviceDate: defaults.serviceDate, editionPublicId: null, status: null });
          }
          this.sundays.set([...options.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)));
          this.nextFrom.set(defaults.nextFrom);
          const selected = this.selectedDate();
          if (!selected || (advancedCursor && selected < advancedCursor)) this.selectedDate.set(defaults.serviceDate);
          this.datesLoading.set(false);
          if (this.conflictDate) {
            const taken = defaults.sundays.some(s => s.serviceDate === this.conflictDate && s.editionPublicId);
            this.conflictDate = null;
            this.toast(taken ? 'warn' : 'error', taken ? 'bulletins.create.dateTaken' : 'bulletins.toast.createFailed');
          }
        },
        error: () => {
          this.datesLoading.set(false);
          this.datesFailed.set(true);
          if (this.conflictDate) {
            this.conflictDate = null;
            this.toast('error', 'bulletins.toast.createFailed');
          }
        },
      });
  }

  loadMoreDates(): void {
    const from = this.nextFrom();
    if (from && !this.datesLoading()) this.loadDates(from);
  }

  retryDates(): void {
    this.loadDates(this.requestedFrom);
  }

  create(): void {
    if (!this.canWrite() || this.creating() || this.datesLoading() || this.datesFailed()) return;
    const sunday = this.selectedSunday();
    if (!sunday) return;
    if (sunday.editionPublicId) {
      this.closeCreate();
      this.openEdit(sunday.editionPublicId);
      return;
    }
    const source = this.copySource();
    const copyFrom = this.createMode() === 'copy' && source ? source.publicId : undefined;
    this.creating.set(true);
    this.service.create({ serviceDate: sunday.serviceDate, ...(copyFrom ? { copyFrom } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: edition => {
          this.creating.set(false);
          this.createVisible.set(false);
          this.toast('success', 'bulletins.toast.created');
          this.openEdit(edition.publicId);
        },
        error: (err: unknown) => {
          this.creating.set(false);
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.conflictDate = sunday.serviceDate;
            this.loadDates(sunday.serviceDate);
          } else {
            this.toast('error', 'bulletins.toast.createFailed');
          }
        },
      });
  }

  copyHint(): string {
    const source = this.copySource();
    return source
      ? this.translate.instant('bulletins.create.copyHint', {
        date: source.serviceDate,
        volume: source.volume === null ? '' : `${this.volumeLabel(source)} · `,
      })
      : '';
  }

  confirmDelete(id: string): void {
    const e = this.editions().find(x => x.publicId === id);
    if (!e || !this.canDelete(id)) return;
    this.confirm.confirm({
      header: this.translate.instant('bulletins.delete.header'),
      message: this.translate.instant('bulletins.delete.message', {
        date: formatServiceDate(e.serviceDate, this.translate.instant('bulletins.sunday')),
      }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('bulletins.delete.action'),
      rejectLabel: this.translate.instant('bulletins.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.delete(id),
    });
  }

  private delete(id: string): void {
    this.service.delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast('success', 'bulletins.toast.deleted');
          this.load();
        },
        error: () => this.toast('error', 'bulletins.toast.deleteFailed'),
      });
  }

  private volumeLabel(e: BulletinEditionSummary): string {
    return e.volume === null ? '—' : this.translate.instant('bulletins.volume', { volume: e.volume });
  }

  private toast(severity: 'success' | 'error' | 'warn', key: string): void {
    this.messages.add({ severity, summary: this.translate.instant(key) });
  }
}
