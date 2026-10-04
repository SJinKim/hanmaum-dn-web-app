import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { BreakpointService } from '../../../core/ui/breakpoint.service';
import { EventRsvpAttendeesResponse } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';
import { EventRsvpAttendeesComponent, attendeeGroupLabel, groupBreakdown } from './event-rsvp-attendees.component';

const RESULT: EventRsvpAttendeesResponse = {
  eventPublicId: 'e1',
  eventTitle: '가을 수련회',
  totalCount: 3,
  attendees: [
    { memberName: '김철수', groupName: '1순', groupDivision: 'DANIEL', checkedInAt: '2026-09-18T10:02:00Z' },
    { memberName: '이영희', groupName: '2순', groupDivision: 'NEHEMIAH', checkedInAt: '2026-09-18T10:05:00Z' },
    { memberName: '박민수', groupName: '1순', groupDivision: 'DANIEL', checkedInAt: '2026-09-18T10:09:00Z' },
  ],
};

describe('EventRsvpAttendeesComponent', () => {
  let service: jasmine.SpyObj<EventRsvpService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['getAttendees', 'getRsvps', 'getEventAnnouncements']);
    service.getAttendees.and.returnValue(of(RESULT));
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

  it('counts distinct 순 per 부서', () => {
    expect(groupBreakdown(RESULT.attendees)).toEqual({ total: 2, byDivision: '다니엘 1 · 느헤미야 1' });
  });

  it('numbers attendees in check-in order', () => {
    const c = render().componentInstance;
    expect(c.title()).toBe('가을 수련회');
    expect(c.records().map(r => r.cells?.['order'])).toEqual([1, 2, 3]);
    expect(c.records()[1].cells?.['group']).toBe('느헤미야 2순');
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
    expect(service.getAttendees).toHaveBeenCalledTimes(2);
  });
});
