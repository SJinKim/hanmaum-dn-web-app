import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { EventRsvpDto } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';
import { EventRsvpListComponent, eventRsvpStats } from './event-rsvp-list.component';

const KO = {
  events: {
    title: '이벤트',
    columns: { title: '이벤트', windowStart: '접수 시작', windowEnd: '접수 종료', status: '상태', actions: '작업' },
    status: { OPEN: '접수 중', SCHEDULED: '예정', CLOSED: '종료', INACTIVE: '비활성' },
  },
};

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const RSVPS: EventRsvpDto[] = [
  { publicId: 'open', title: '가을 수련회', windowStart: iso(-2), windowEnd: iso(2), isActive: true, announcementPublicId: null },
  { publicId: 'later', title: '성탄 예배', windowStart: iso(10), windowEnd: iso(20), isActive: true, announcementPublicId: null },
  { publicId: 'past', title: '여름 캠프', windowStart: iso(-20), windowEnd: iso(-10), isActive: true, announcementPublicId: null },
  { publicId: 'off', title: '비공개', windowStart: iso(-3), windowEnd: iso(2), isActive: false, announcementPublicId: null },
];

describe('EventRsvpListComponent', () => {
  let service: jasmine.SpyObj<EventRsvpService>;
  let isPhone: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['getRsvps', 'createRsvp', 'updateRsvp']);
    service.getRsvps.and.returnValue(of(RSVPS));
    isPhone = signal(false);
    TestBed.configureTestingModule({
      imports: [EventRsvpListComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: EventRsvpService, useValue: service },
        { provide: BreakpointService, useValue: { isPhone } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(EventRsvpListComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('counts 종료 and 비활성 together', () => {
    expect(eventRsvpStats(RSVPS)).toEqual({ total: 4, open: 1, scheduled: 1, closed: 2 });
  });

  it('lists the newest 접수 시작 first with a status badge', () => {
    const records = render().componentInstance.records();
    expect(records.map(r => r.id)).toEqual(['later', 'open', 'off', 'past']);
    expect(records[0].badge).toEqual({ variant: 'pending', label: '예정' });
    expect(records[1].badge?.variant).toBe('active');
    expect(records[2].badge?.variant).toBe('inactive');
    expect(records[3].badge?.variant).toBe('neutral');
  });

  it('opens the attendee list from the row', () => {
    const fixture = render();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.openAttendees('open');
    expect(navigate).toHaveBeenCalledWith(['/event-rsvps', 'open', 'attendees']);
  });

  it('opens the dialog empty for 새 이벤트 and filled for 수정', () => {
    const c = render().componentInstance;
    c.openAdd();
    expect(c.dialogVisible()).toBeTrue();
    expect(c.editing()).toBeNull();
    c.openEdit('past');
    expect(c.editing()?.title).toBe('여름 캠프');
  });

  it('reloads after a save', () => {
    const c = render().componentInstance;
    c.onSaved();
    expect(service.getRsvps).toHaveBeenCalledTimes(2);
  });

  it('shows list cards on Phone', () => {
    isPhone.set(true);
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelectorAll('app-list-card').length).toBe(4);
    expect(el.querySelector('app-data-table')).toBeNull();
  });

  it('stops loading when the list fails', () => {
    service.getRsvps.and.returnValue(throwError(() => new Error('x')));
    const c = render().componentInstance;
    expect(c.loading()).toBeFalse();
    expect(c.records()).toEqual([]);
  });
});
