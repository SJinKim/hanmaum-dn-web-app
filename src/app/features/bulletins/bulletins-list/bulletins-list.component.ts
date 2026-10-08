import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
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
import { BULLETIN_STATUS_BADGE, BulletinEditionSummary, formatServiceDate } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';

export type CreateMode = 'copy' | 'blank';

/**
 * 주보 (#36) — Figma: 주보 · 목록. Newest Sunday first, as the server sorts.
 *
 * 새 주보 asks whether to copy the newest edition; the server picks the next
 * free Sunday and the default service, then the editor opens.
 */
@Component({
  selector: 'app-bulletins-list',
  standalone: true,
  imports: [
    TranslatePipe, ButtonModule, ConfirmDialogModule, DialogModule, TabsModule, ToastModule,
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
  readonly activeTab = signal(0);

  readonly createVisible = signal(false);
  readonly createMode = signal<CreateMode>('copy');
  readonly creating = signal(false);

  /** The edition 지난 주보 복사 takes over: the newest one. */
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
    this.createVisible.set(true);
  }

  create(): void {
    const source = this.copySource();
    const copyFrom = this.createMode() === 'copy' && source ? source.publicId : undefined;
    this.creating.set(true);
    this.service.create(copyFrom ? { copyFrom } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: edition => {
          this.creating.set(false);
          this.createVisible.set(false);
          this.toast('success', 'bulletins.toast.created');
          this.openEdit(edition.publicId);
        },
        error: () => {
          this.creating.set(false);
          this.toast('error', 'bulletins.toast.createFailed');
        },
      });
  }

  copyHint(): string {
    const source = this.copySource();
    return source
      ? this.translate.instant('bulletins.create.copyHint', {
        date: formatServiceDate(source.serviceDate, this.translate.instant('bulletins.sunday')),
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

  private toast(severity: 'success' | 'error', key: string): void {
    this.messages.add({ severity, summary: this.translate.instant(key) });
  }
}
