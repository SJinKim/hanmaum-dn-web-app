import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { EventResponses } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';
import { EventRsvpAttendeesComponent, attendeeGroupLabel } from './event-rsvp-attendees.component';

const RESULT: EventResponses = {
  eventPublicId: 'e1', eventTitle: '가을 수련회', expectedCount: 4, respondedCount: 3,
  goingCount: 1, notGoingCount: 1, maybeCount: 1, pendingCount: 1,
  responses: [
    { memberPublicId: 'm1', memberName: '김철수', groupName: '1순', groupDivision: 'DANIEL', status: 'GOING', respondedAt: '2026-09-18T10:02:00Z' },
    { memberPublicId: 'm2', memberName: '이영희', groupName: '2순', groupDivision: 'NEHEMIAH', status: 'NOT_GOING', respondedAt: '2026-09-18T10:05:00Z' },
    { memberPublicId: 'm3', memberName: '박민수', groupName: '1순', groupDivision: 'DANIEL', status: 'MAYBE', respondedAt: '2026-09-18T10:09:00Z' },
    { memberPublicId: 'm4', memberName: '박민수', groupName: null, groupDivision: null, status: null, respondedAt: null },
  ],
};

describe('EventRsvpAttendeesComponent', () => {
  let service: jasmine.SpyObj<EventRsvpService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['getResponses', 'getRsvps', 'getEventAnnouncements']);
    service.getResponses.and.returnValue(of(RESULT));
    service.getRsvps.and.returnValue(of([
      { publicId: 'e1', title: '가을 수련회', windowStart: '', windowEnd: '', isActive: true, announcementPublicId: 'a1' },
    ]));
    service.getEventAnnouncements.and.returnValue(of([{ id: 'a1', title: '수련회 안내' }]));
    TestBed.configureTestingModule({
      imports: [EventRsvpAttendeesComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: EventRsvpService, useValue: service },
        { provide: BreakpointService, useValue: { isPhone: signal(false) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(EventRsvpAttendeesComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('labels the 순 with its 부서', () => {
    expect(attendeeGroupLabel({ groupName: '1순', groupDivision: 'DANIEL' })).toBe('다니엘 1순');
    expect(attendeeGroupLabel({ groupName: '새가족', groupDivision: null })).toBe('새가족');
    expect(attendeeGroupLabel({ groupName: null, groupDivision: null })).toBe('');
  });

  it('shows each saved answer with a stable member id', () => {
    const c = render().componentInstance;
    expect(c.title()).toBe('가을 수련회');
    expect(c.records().map(r => r.cells?.['order'])).toEqual([1, 2, 3, 4]);
    expect(c.records()[1].cells?.['group']).toBe('느헤미야 2순');
    expect(c.records().map(r => r.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(c.records().map(r => r.badge?.variant)).toEqual(['active', 'deleted', 'inactive', 'neutral']);
    expect(c.records()[3].meta).toBe('—');
  });

  it('links the 이벤트 공지', () => {
    const fixture = render();
    expect(fixture.componentInstance.linkedAnnouncement()).toEqual({ id: 'a1', title: '수련회 안내' });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.viewAnnouncement();
    expect(navigate).toHaveBeenCalledWith(['/announcements'], { queryParams: { focus: 'a1' } });
  });

  it('reloads on 새로고침', () => {
    const c = render().componentInstance;
    c.load();
    expect(service.getResponses).toHaveBeenCalledTimes(2);
  });

  it('filters MAYBE separately from members without an answer', () => {
    const c = render().componentInstance;
    c.responseFilter.set('MAYBE');
    expect(c.records().map(r => r.id)).toEqual(['m3']);
    c.responseFilter.set('PENDING');
    expect(c.records().map(r => r.id)).toEqual(['m4']);
    c.responseFilter.set('NOT_GOING');
    expect(c.records().map(r => r.id)).toEqual(['m2']);
    expect(c.filters().map(f => f.count)).toEqual([4, 1, 1, 1, 1]);
  });

  it('renders response badges in phone cards', () => {
    TestBed.overrideProvider(BreakpointService, { useValue: { isPhone: signal(true) } });
    const fixture = render();
    expect(fixture.nativeElement.querySelectorAll('app-list-card app-badge').length).toBe(4);
  });

  it('shows load failure instead of pretending the event has no responses', () => {
    service.getResponses.and.returnValue(throwError(() => new Error('offline')));
    const fixture = render();
    expect(fixture.componentInstance.loadFailed()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('events.errors.attendees');
  });
});
