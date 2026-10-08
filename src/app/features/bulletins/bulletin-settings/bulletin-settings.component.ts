import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
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
import { BULLETIN_SECTION_KEYS, BulletinSectionTitle, BulletinService } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';
import { BulletinServiceDialogComponent, hhmm } from './bulletin-service-dialog.component';

export const SECTION_TITLE_MAX = 100;

/**
 * 주보 · 설정 (#194). Two cards: the Sunday services (1부 · 2부 · 3부) and the
 * four section titles the bulletin prints. Admin and pastor only, like the list.
 */
@Component({
  selector: 'app-bulletin-settings',
  standalone: true,
  imports: [
    FormsModule, TranslatePipe,
    ButtonModule, ConfirmDialogModule, DialogModule, InputTextModule, TabsModule, ToastModule,
    DataCellDirective, DataTableComponent, EmptyStateComponent, ListCardComponent,
    PageHeaderComponent, SectionHeaderComponent, SkeletonComponent,
    BulletinServiceDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './bulletin-settings.component.html',
})
export class BulletinSettingsComponent implements OnInit {
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

  readonly titleMax = SECTION_TITLE_MAX;

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly services = signal<BulletinService[]>([]);
  readonly titles = signal<BulletinSectionTitle[]>([]);

  readonly serviceVisible = signal(false);
  readonly editingService = signal<BulletinService | null>(null);
  readonly nextSortOrder = computed(() => Math.max(0, ...this.services().map(s => s.sortOrder)) + 1);

  readonly titleVisible = signal(false);
  readonly editingTitle = signal<BulletinSectionTitle | null>(null);
  readonly titleDraft = signal('');
  readonly savingTitle = signal(false);

  readonly subtitle = computed(() => {
    this.lang();
    return this.translate.instant('bulletins.settings.subtitle', {
      services: this.services().length,
      titles: this.titles().length,
    }) as string;
  });

  readonly serviceColumns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`bulletins.settings.columns.${key}`) as string;
    return [
      { type: 'text', key: 'name', header: t('name'), tone: 'strong' },
      { type: 'text', key: 'day', header: t('day'), width: '160px' },
      { type: 'text', key: 'startTime', header: t('startTime'), width: '160px' },
      { type: 'badge', header: t('status'), width: '140px' },
      { type: 'custom', key: 'actions', header: t('actions'), width: '112px', align: 'end' },
    ];
  });

  readonly serviceRecords = computed<DataRecord[]>(() => {
    this.lang();
    const day = this.translate.instant('bulletins.settings.sunday') as string;
    const suffix = this.translate.instant('bulletins.settings.defaultSuffix') as string;
    return this.services().map(s => {
      const name = s.isBulletinDefault ? `${s.name} ${suffix}` : s.name;
      const startTime = hhmm(s.startTime);
      return {
        id: s.publicId,
        title: name,
        subtitle: `${day} · ${startTime}`,
        badge: {
          variant: s.active ? 'active' : 'inactive',
          label: this.translate.instant(`bulletins.settings.status.${s.active ? 'active' : 'inactive'}`) as string,
        },
        cells: { name, day, startTime },
      };
    });
  });

  readonly titleColumns = computed<DataColumn[]>(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(`bulletins.settings.columns.${key}`) as string;
    return [
      { type: 'text', key: 'position', header: t('position') },
      { type: 'text', key: 'title', header: t('title'), tone: 'strong' },
      { type: 'text', key: 'default', header: t('default') },
      { type: 'badge', header: t('status'), width: '140px' },
      { type: 'custom', key: 'actions', header: t('actions'), width: '112px', align: 'end' },
    ];
  });

  readonly titleRecords = computed<DataRecord[]>(() => {
    this.lang();
    return [...this.titles()]
      .sort((a, b) => BULLETIN_SECTION_KEYS.indexOf(a.key) - BULLETIN_SECTION_KEYS.indexOf(b.key))
      .map(t => {
        const position = this.translate.instant(`bulletins.settings.positions.${t.key}`) as string;
        const changed = isChanged(t);
        return {
          id: t.key,
          title: t.title,
          subtitle: position,
          badge: {
            variant: changed ? 'pending' : 'active',
            label: this.translate.instant(`bulletins.settings.status.${changed ? 'changed' : 'default'}`) as string,
          },
          cells: { position, title: t.title, default: t.defaultTitle },
        };
      });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({ services: this.service.services(), titles: this.service.sectionTitles() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ services, titles }) => {
          this.services.set(services);
          this.titles.set(titles);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  /** Tab 0 is 주보 목록, which lives on its own route. */
  onTab(value: unknown): void {
    if (value === 0) void this.router.navigate(['/bulletins']);
  }

  openAddService(): void {
    this.editingService.set(null);
    this.serviceVisible.set(true);
  }

  openEditService(id: string): void {
    const s = this.services().find(x => x.publicId === id);
    if (!s || !this.canWrite()) return;
    this.editingService.set(s);
    this.serviceVisible.set(true);
  }

  onServiceSaved(): void {
    this.toast('success', 'bulletins.settings.toast.saved');
    this.load();
  }

  onServiceFailed(): void {
    this.toast('error', 'bulletins.settings.toast.saveFailed');
  }

  confirmDeleteService(id: string): void {
    const s = this.services().find(x => x.publicId === id);
    if (!s) return;
    this.confirm.confirm({
      header: this.translate.instant('bulletins.settings.delete.header'),
      message: this.translate.instant('bulletins.settings.delete.message', { name: s.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('bulletins.delete.action'),
      rejectLabel: this.translate.instant('bulletins.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.deleteService(id),
    });
  }

  /** 204 deletes; a service an edition still uses comes back deactivated (200). */
  private deleteService(id: string): void {
    this.service.deleteService(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: kept => {
          this.toast('success', kept ? 'bulletins.settings.toast.deactivated' : 'bulletins.settings.toast.deleted');
          this.load();
        },
        error: (err: unknown) => {
          const conflict = err instanceof HttpErrorResponse && err.status === 409;
          this.toast('error', conflict ? 'bulletins.settings.toast.defaultConflict' : 'bulletins.settings.toast.deleteFailed');
        },
      });
  }

  openEditTitle(key: string): void {
    const t = this.titles().find(x => x.key === key);
    if (!t || !this.canWrite()) return;
    this.editingTitle.set(t);
    this.titleDraft.set(t.title);
    this.titleVisible.set(true);
  }

  /** 기본값으로 fills in the default; saving it stores null, so a later default change applies. */
  resetTitle(): void {
    const t = this.editingTitle();
    if (t) this.titleDraft.set(t.defaultTitle);
  }

  saveTitle(): void {
    const t = this.editingTitle();
    if (!t) return;
    const draft = this.titleDraft().trim();
    const title = draft === '' || draft === t.defaultTitle ? null : draft;
    this.savingTitle.set(true);
    this.service.updateSectionTitle(t.key, { title })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: saved => {
          this.savingTitle.set(false);
          this.titleVisible.set(false);
          this.titles.update(list => list.map(x => (x.key === saved.key ? saved : x)));
          this.toast('success', 'bulletins.settings.toast.saved');
        },
        error: () => {
          this.savingTitle.set(false);
          this.toast('error', 'bulletins.settings.toast.saveFailed');
        },
      });
  }

  private toast(severity: 'success' | 'error', key: string): void {
    this.messages.add({ severity, summary: this.translate.instant(key) });
  }
}

function isChanged(t: BulletinSectionTitle): boolean {
  return t.title !== t.defaultTitle;
}
