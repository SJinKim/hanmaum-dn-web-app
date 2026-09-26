import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Menu, MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';

import { injectAppLang } from '../../../core/i18n/language';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../../core/ui/search-field/search-field.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { BadgeVariant } from '../../../core/ui/variant-tokens';
import { AnnouncementDialogComponent } from '../announcement-dialog/announcement-dialog.component';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_BADGE,
  AnnouncementCategory,
  AnnouncementDto,
  formatAnnouncementDate,
  sortAnnouncements,
} from '../announcements.model';
import { AnnouncementsService } from '../announcements.service';

export interface CategoryChip {
  category: AnnouncementCategory | null;
  label: string;
  count: number;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  badge: { variant: BadgeVariant; label: string };
  period: string;
}

/**
 * 공지사항 (#59) — Figma: list 222:9396, 공지 작성 dialog 222:11617.
 *
 * One card with every 공지, 고정 first. Search and the category chips filter
 * on the client; the admin endpoint returns all 공지 including expired ones.
 */
@Component({
  selector: 'app-announcements-list',
  standalone: true,
  imports: [
    TranslatePipe, ButtonModule, ConfirmDialogModule, MenuModule, ToastModule,
    AnnouncementDialogComponent, BadgeComponent, EmptyStateComponent, FilterChipComponent,
    PageHeaderComponent, SearchFieldComponent, SectionHeaderComponent, SkeletonComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './announcements-list.component.html',
})
export class AnnouncementsListComponent implements OnInit {
  private readonly service    = inject(AnnouncementsService);
  private readonly messages   = inject(MessageService);
  private readonly confirm    = inject(ConfirmationService);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route      = inject(ActivatedRoute);
  private readonly lang       = injectAppLang();

  private readonly rowMenu = viewChild<Menu>('rowMenu');

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly announcements = signal<AnnouncementDto[]>([]);

  readonly search = signal('');
  readonly category = signal<AnnouncementCategory | null>(null);

  readonly dialogVisible = signal(false);
  readonly editing = signal<AnnouncementDto | null>(null);
  readonly menuItems = signal<MenuItem[]>([]);

  /** Search narrows the chip counts too, so each count matches what a click shows. */
  private readonly searched = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = sortAnnouncements(this.announcements());
    return term
      ? all.filter(a => a.title.toLowerCase().includes(term) || a.body.toLowerCase().includes(term))
      : all;
  });

  readonly chips = computed<CategoryChip[]>(() => {
    this.lang();
    const items = this.searched();
    return [
      { category: null, label: this.translate.instant('announcements.all'), count: items.length },
      ...ANNOUNCEMENT_CATEGORIES.map(category => ({
        category,
        label: this.categoryLabel(category),
        count: items.filter(a => a.category === category).length,
      })),
    ];
  });

  readonly rows = computed<AnnouncementRow[]>(() => {
    this.lang();
    const category = this.category();
    return this.searched()
      .filter(a => !category || a.category === category)
      .map(a => ({
        id: a.id,
        title: a.title,
        body: a.body,
        isPinned: a.isPinned,
        badge: { variant: ANNOUNCEMENT_CATEGORY_BADGE[a.category], label: this.categoryLabel(a.category) },
        period: this.translate.instant('announcements.period', {
          start: formatAnnouncementDate(a.startAt),
          end: a.endAt ? formatAnnouncementDate(a.endAt) : this.translate.instant('announcements.openEnd'),
        }),
      }));
  });

  ngOnInit(): void {
    this.load(this.route.snapshot.queryParamMap.get('focus'));
  }

  load(focusId: string | null = null): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service.getAnnouncements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          this.announcements.set(items);
          this.loading.set(false);
          // 최근 활동 links here with ?focus=<id>: open that 공지 for editing.
          if (focusId) this.openEdit(focusId);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  /** The active chip again, or 전체, clears the filter. */
  selectCategory(category: AnnouncementCategory | null): void {
    this.category.set(category === this.category() ? null : category);
  }

  openAdd(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(id: string): void {
    const item = this.announcements().find(a => a.id === id);
    if (!item) return;
    this.editing.set(item);
    this.dialogVisible.set(true);
  }

  toggleRowMenu(event: Event, id: string): void {
    this.menuItems.set([
      { label: this.translate.instant('announcements.edit'), icon: 'pi pi-pencil', command: () => this.openEdit(id) },
      { label: this.translate.instant('announcements.delete.action'), icon: 'pi pi-trash', command: () => this.confirmDelete(id) },
    ]);
    this.rowMenu()?.toggle(event);
  }

  confirmDelete(id: string): void {
    const item = this.announcements().find(a => a.id === id);
    if (!item) return;
    this.confirm.confirm({
      header: this.translate.instant('announcements.delete.header'),
      message: this.translate.instant('announcements.delete.message', { title: item.title }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('announcements.delete.action'),
      rejectLabel: this.translate.instant('announcements.dialog.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => this.delete(id),
    });
  }

  onSaved(): void {
    this.toast('success', this.editing() ? 'announcements.toast.updated' : 'announcements.toast.created');
    this.load();
  }

  onSaveFailed(): void {
    this.toast('error', 'announcements.toast.saveFailed');
  }

  private delete(id: string): void {
    this.service.deleteAnnouncement(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast('success', 'announcements.toast.deleted');
          this.load();
        },
        error: () => this.toast('error', 'announcements.toast.deleteFailed'),
      });
  }

  private toast(severity: 'success' | 'error', key: string): void {
    this.messages.add({ severity, summary: this.translate.instant(key) });
  }

  private categoryLabel(category: AnnouncementCategory): string {
    return this.translate.instant(`announcements.category.${category}`);
  }
}
