import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { interval } from 'rxjs';
import { SelectModule } from 'primeng/select';
import {
  EventAnnouncementOption,
  EventRsvpDto,
  EventRsvpStatus,
  eventRsvpStatus,
} from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';

@Component({
  selector: 'app-event-rsvp-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DatePickerModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    ToggleSwitchModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './event-rsvp-list.component.html',
})
export class EventRsvpListComponent implements OnInit {
  private readonly service = inject(EventRsvpService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rsvps = signal<EventRsvpDto[]>([]);
  readonly eventAnnouncements = signal<EventAnnouncementOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searchTerm = signal('');
  readonly now = signal(new Date());

  readonly announcementTitles = computed(() => {
    const map = new Map<string, string>();
    for (const announcement of this.eventAnnouncements()) {
      map.set(announcement.id, announcement.title);
    }
    return map;
  });

  dialogVisible = false;
  editTarget: EventRsvpDto | null = null;
  formTitle = '';
  formWindowStart: Date | null = null;
  formWindowEnd: Date | null = null;
  formAnnouncementId = '';
  formIsActive = true;

  readonly filteredRsvps = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('ko');
    const rows = query
      ? this.rsvps().filter(rsvp => rsvp.title.toLocaleLowerCase('ko').includes(query))
      : this.rsvps();

    return [...rows].sort(
      (left, right) => new Date(right.windowStart).getTime() - new Date(left.windowStart).getTime(),
    );
  });

  readonly openCount = computed(() =>
    this.rsvps().filter(rsvp => this.status(rsvp) === 'OPEN').length,
  );

  readonly scheduledCount = computed(() =>
    this.rsvps().filter(rsvp => this.status(rsvp) === 'SCHEDULED').length,
  );

  readonly closedCount = computed(() =>
    this.rsvps().filter(rsvp => ['CLOSED', 'INACTIVE'].includes(this.status(rsvp))).length,
  );

  ngOnInit(): void {
    this.load();
    this.loadAnnouncements();
    interval(60_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(new Date()));
  }

  private loadAnnouncements(): void {
    this.service.getEventAnnouncements().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: announcements => this.eventAnnouncements.set(announcements),
      error: error => this.showError(error, 'EVENT 공지 목록을 불러올 수 없습니다.'),
    });
  }

  announcementTitle(publicId: string | null): string | null {
    if (!publicId) return null;
    return this.announcementTitles().get(publicId) ?? null;
  }

  load(): void {
    this.loading.set(true);
    this.service.getRsvps().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rsvps => {
        this.rsvps.set(rsvps);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.showError(error, 'RSVP 목록을 불러올 수 없습니다.');
      },
    });
  }

  openCreate(): void {
    this.editTarget = null;
    this.formTitle = '';
    this.formWindowStart = null;
    this.formWindowEnd = null;
    this.formAnnouncementId = '';
    this.formIsActive = true;
    this.dialogVisible = true;
  }

  openEdit(rsvp: EventRsvpDto): void {
    this.editTarget = rsvp;
    this.formTitle = rsvp.title;
    this.formWindowStart = new Date(rsvp.windowStart);
    this.formWindowEnd = new Date(rsvp.windowEnd);
    this.formAnnouncementId = rsvp.announcementPublicId ?? '';
    this.formIsActive = rsvp.isActive;
    this.dialogVisible = true;
  }

  save(): void {
    const title = this.formTitle.trim();
    if (!title || !this.formWindowStart || !this.formWindowEnd) {
      this.messageService.add({
        severity: 'warn',
        summary: '입력 오류',
        detail: '제목과 RSVP 시작 및 종료 시간을 입력해주세요.',
      });
      return;
    }

    if (this.formWindowEnd <= this.formWindowStart) {
      this.messageService.add({
        severity: 'warn',
        summary: '입력 오류',
        detail: '종료 시간은 시작 시간 이후여야 합니다.',
      });
      return;
    }

    const announcementId = this.formAnnouncementId.trim();
    if (!announcementId) {
      this.messageService.add({
        severity: 'warn',
        summary: '입력 오류',
        detail: '연결할 EVENT 공지를 선택해주세요.',
      });
      return;
    }

    this.saving.set(true);
    const windowStart = this.formWindowStart.toISOString();
    const windowEnd = this.formWindowEnd.toISOString();
    const request$ = this.editTarget
      ? this.service.updateRsvp(this.editTarget.publicId, {
          title,
          windowStart,
          windowEnd,
          isActive: this.formIsActive,
          announcementId,
        })
      : this.service.createRsvp({
          title,
          windowStart,
          windowEnd,
          announcementId,
        });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: '완료',
          detail: this.editTarget ? 'RSVP가 수정되었습니다.' : 'RSVP가 생성되었습니다.',
        });
        this.load();
      },
      error: error => {
        this.saving.set(false);
        this.showError(error, this.editTarget ? 'RSVP 수정에 실패했습니다.' : 'RSVP 생성에 실패했습니다.');
      },
    });
  }

  confirmDeactivate(rsvp: EventRsvpDto, event: Event): void {
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      header: 'RSVP 비활성화',
      message: `“${rsvp.title}” RSVP를 비활성화하시겠습니까?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '비활성화',
      rejectLabel: '취소',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deactivate(rsvp),
    });
  }

  viewAttendees(rsvp: EventRsvpDto): void {
    this.router.navigate(['/event-rsvps', rsvp.publicId, 'attendees']);
  }

  status(rsvp: EventRsvpDto): EventRsvpStatus {
    return eventRsvpStatus(rsvp, this.now());
  }

  statusLabel(status: EventRsvpStatus): string {
    return {
      OPEN: '접수 중',
      SCHEDULED: '예정',
      CLOSED: '종료',
      INACTIVE: '비활성',
    }[status];
  }

  statusSeverity(status: EventRsvpStatus): 'success' | 'info' | 'secondary' | 'warn' {
    return {
      OPEN: 'success' as const,
      SCHEDULED: 'info' as const,
      CLOSED: 'secondary' as const,
      INACTIVE: 'warn' as const,
    }[status];
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private deactivate(rsvp: EventRsvpDto): void {
    this.service.deactivateRsvp(rsvp.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: '완료',
            detail: 'RSVP가 비활성화되었습니다.',
          });
          this.load();
        },
        error: error => this.showError(error, 'RSVP 비활성화에 실패했습니다.'),
      });
  }

  private showError(error: { message?: string } | null, fallback: string): void {
    this.messageService.add({
      severity: 'error',
      summary: '오류',
      detail: error?.message ?? fallback,
    });
  }
}
