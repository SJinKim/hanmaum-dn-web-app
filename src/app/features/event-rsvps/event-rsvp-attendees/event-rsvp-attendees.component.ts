import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { EventRsvpAttendeesResponse } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';

@Component({
  selector: 'app-event-rsvp-attendees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './event-rsvp-attendees.component.html',
})
export class EventRsvpAttendeesComponent implements OnInit {
  private readonly service = inject(EventRsvpService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly result = signal<EventRsvpAttendeesResponse | null>(null);
  readonly loading = signal(false);
  readonly searchTerm = signal('');
  readonly linkedAnnouncement = signal<{ id: string; title: string } | null>(null);
  readonly eventPublicId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly filteredAttendees = computed(() => {
    const attendees = this.result()?.attendees ?? [];
    const query = this.searchTerm().trim().toLocaleLowerCase('ko');
    if (!query) return attendees;

    return attendees.filter(attendee =>
      [attendee.memberName, attendee.groupName, attendee.groupDivision]
        .filter((value): value is string => Boolean(value))
        .some(value => value.toLocaleLowerCase('ko').includes(query)),
    );
  });

  readonly groupCount = computed(() => new Set(
    (this.result()?.attendees ?? [])
      .map(attendee => attendee.groupName)
      .filter((name): name is string => Boolean(name)),
  ).size);

  ngOnInit(): void {
    this.load();
    this.resolveLinkedAnnouncement();
  }

  private resolveLinkedAnnouncement(): void {
    if (!this.eventPublicId) return;
    forkJoin({
      rsvps: this.service.getRsvps(),
      announcements: this.service.getEventAnnouncements(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ rsvps, announcements }) => {
          const rsvp = rsvps.find(item => item.publicId === this.eventPublicId);
          const announcementId = rsvp?.announcementPublicId;
          if (!announcementId) {
            this.linkedAnnouncement.set(null);
            return;
          }
          const title = announcements.find(item => item.id === announcementId)?.title;
          this.linkedAnnouncement.set({ id: announcementId, title: title ?? '연결 공지' });
        },
        error: () => this.linkedAnnouncement.set(null),
      });
  }

  load(): void {
    if (!this.eventPublicId) return;
    this.loading.set(true);
    this.service.getAttendees(this.eventPublicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: error => {
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: '오류',
            detail: error?.message ?? '참석자 명단을 불러올 수 없습니다.',
          });
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/event-rsvps']);
  }

  viewAnnouncement(): void {
    const announcement = this.linkedAnnouncement();
    if (!announcement) return;
    this.router.navigate(['/announcements'], { queryParams: { focus: announcement.id } });
  }

  groupLabel(groupDivision: string | null, groupName: string | null): string {
    if (!groupName) return '소속 그룹 없음';
    return groupDivision ? `${groupDivision} · ${groupName}` : groupName;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  }
}
