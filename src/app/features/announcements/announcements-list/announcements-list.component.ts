import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AnnouncementsService } from '../announcements.service';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_CATEGORY_OPTIONS,
  ANNOUNCEMENT_CATEGORY_TAGS,
  AnnouncementCategory,
  AnnouncementCategoryTagConfig,
  AnnouncementDto,
} from '../announcements.model';

@Component({
  selector: 'app-announcements-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    CheckboxModule,
    DatePickerModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './announcements-list.component.html',
})
export class AnnouncementsListComponent implements OnInit {
  private readonly service    = inject(AnnouncementsService);
  private readonly messageSvc = inject(MessageService);
  private readonly confirmSvc = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route      = inject(ActivatedRoute);

  announcements = signal<AnnouncementDto[]>([]);
  loading       = signal(false);
  showForm      = signal(false);
  editingId     = signal<string | null>(null);
  selected      = signal<AnnouncementDto | null>(null);

  readonly categoryOptions = ANNOUNCEMENT_CATEGORY_OPTIONS;

  // form state (used for both create and edit)
  formTitle    = '';
  formBody     = '';
  formCategory: AnnouncementCategory | null = null;
  formStartAt: Date | null = null;
  formEndAt:   Date | null = null;
  formIsPinned = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.getAnnouncements().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.announcements.set(items);
        const current = this.selected();
        if (current) {
          this.selected.set(items.find(i => i.id === current.id) ?? null);
        } else {
          this.applyFocusFromQuery(items);
        }
        this.loading.set(false);
      },
      error: () => {
        this.messageSvc.add({ severity: 'error', summary: 'Error', detail: 'Failed to load announcements.' });
        this.loading.set(false);
      },
    });
  }

  private applyFocusFromQuery(items: AnnouncementDto[]): void {
    const focusId = this.route.snapshot.queryParamMap.get('focus');
    if (!focusId) return;
    const match = items.find(i => i.id === focusId);
    if (match) this.selected.set(match);
  }

  categoryLabel(category: AnnouncementCategory): string {
    return ANNOUNCEMENT_CATEGORY_LABELS[category];
  }

  categoryTag(category: AnnouncementCategory): AnnouncementCategoryTagConfig {
    return ANNOUNCEMENT_CATEGORY_TAGS[category];
  }

  formatDateTime(value: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  openCreate(): void {
    this.resetForm();
    this.editingId.set(null);
    this.showForm.set(true);
  }

  selectRow(item: AnnouncementDto): void {
    this.selected.set(this.selected()?.id === item.id ? null : item);
  }

  clearSelection(): void {
    this.selected.set(null);
  }

  openEdit(item: AnnouncementDto, event?: Event): void {
    event?.stopPropagation();
    this.editingId.set(item.id);
    this.formTitle    = item.title;
    this.formBody     = item.body;
    this.formCategory = item.category;
    this.formStartAt  = new Date(item.startAt);
    this.formEndAt    = item.endAt ? new Date(item.endAt) : null;
    this.formIsPinned = item.isPinned;
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.resetForm();
  }

  onFormSubmit(): void {
    if (!this.formTitle.trim() || !this.formBody.trim() || !this.formCategory || !this.formStartAt) {
      this.messageSvc.add({ severity: 'warn', summary: 'Validation error', detail: 'Title, content, category, and start date are required.' });
      return;
    }

    const payload = {
      title:    this.formTitle.trim(),
      body:     this.formBody.trim(),
      category: this.formCategory,
      startAt:  this.formStartAt.toISOString(),
      endAt:    this.formEndAt ? this.formEndAt.toISOString() : null,
      isPinned: this.formIsPinned,
    };

    const id = this.editingId();
    const obs$ = id
      ? this.service.updateAnnouncement(id, payload)
      : this.service.createAnnouncement(payload);

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.messageSvc.add({
          severity: 'success',
          summary: 'Success',
          detail: id ? 'Announcement updated.' : 'Announcement created.',
        });
        this.cancelForm();
        this.load();
      },
      error: err => {
        const detail = err?.message ?? (id ? 'Failed to update announcement.' : 'Failed to create announcement.');
        this.messageSvc.add({ severity: 'error', summary: 'Error', detail });
      },
    });
  }

  confirmDelete(item: AnnouncementDto, event: Event): void {
    event.stopPropagation();
    this.confirmSvc.confirm({
      target: event.target as EventTarget,
      message: `Delete announcement "${item.title}"?`,
      header: 'Delete Announcement',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'pi pi-trash',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteAnnouncement(item),
    });
  }

  private deleteAnnouncement(item: AnnouncementDto): void {
    this.service.deleteAnnouncement(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageSvc.add({ severity: 'success', summary: 'Deleted', detail: 'Announcement deleted.' });
          if (this.editingId() === item.id) this.cancelForm();
          if (this.selected()?.id === item.id) this.selected.set(null);
          this.load();
        },
        error: err => {
          const detail = err?.message ?? 'Failed to delete announcement.';
          this.messageSvc.add({ severity: 'error', summary: 'Error', detail });
        },
      });
  }

  private resetForm(): void {
    this.formTitle    = '';
    this.formBody     = '';
    this.formCategory = null;
    this.formStartAt  = null;
    this.formEndAt    = null;
    this.formIsPinned = false;
  }
}
