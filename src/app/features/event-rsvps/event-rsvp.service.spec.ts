import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { EventRsvpAttendeesResponse, EventRsvpDto } from './event-rsvp.model';
import { EventRsvpService } from './event-rsvp.service';

describe('EventRsvpService', () => {
  let service: EventRsvpService;
  let api: jasmine.SpyObj<ApiService>;

  const rsvp: EventRsvpDto = {
    publicId: 'rsvp-1',
    title: '여름 수련회',
    windowStart: '2026-07-12T00:00:00.000Z',
    windowEnd: '2026-07-12T03:00:00.000Z',
    isActive: true,
    announcementPublicId: 'announcement-1',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [
        EventRsvpService,
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(EventRsvpService);
  });

  it('lists all event RSVPs', done => {
    api.get.and.returnValue(of([rsvp]));

    service.getRsvps().subscribe(result => {
      expect(result).toEqual([rsvp]);
      expect(api.get).toHaveBeenCalledOnceWith('/v1/events/rsvps');
      done();
    });
  });

  it('creates an event RSVP with an optional announcement', done => {
    const request = {
      title: rsvp.title,
      windowStart: rsvp.windowStart,
      windowEnd: rsvp.windowEnd,
      announcementId: 'announcement-1',
    };
    api.post.and.returnValue(of(rsvp));

    service.createRsvp(request).subscribe(result => {
      expect(result).toBe(rsvp);
      expect(api.post).toHaveBeenCalledOnceWith('/v1/events/rsvps', request);
      done();
    });
  });

  it('patches an existing event RSVP including its announcement', done => {
    const request = { title: '수정된 수련회', isActive: true, announcementId: 'announcement-2' };
    api.patch.and.returnValue(of({ ...rsvp, ...request }));

    service.updateRsvp(rsvp.publicId, request).subscribe(() => {
      expect(api.patch).toHaveBeenCalledOnceWith('/v1/events/rsvps/rsvp-1', request);
      done();
    });
  });

  it('lists only EVENT announcements as options', done => {
    api.get.and.returnValue(of([
      { id: 'a1', title: '여름 수련회 공지', category: 'EVENT' },
      { id: 'a2', title: '주보', category: 'NOTICE' },
      { id: 'a3', title: '청년부 모임', category: 'EVENT' },
    ]));

    service.getEventAnnouncements().subscribe(result => {
      expect(result).toEqual([
        { id: 'a1', title: '여름 수련회 공지' },
        { id: 'a3', title: '청년부 모임' },
      ]);
      expect(api.get).toHaveBeenCalledOnceWith('/v1/announcements/admin');
      done();
    });
  });

  it('deactivates an event RSVP', done => {
    api.delete.and.returnValue(of(undefined));

    service.deactivateRsvp(rsvp.publicId).subscribe(() => {
      expect(api.delete).toHaveBeenCalledOnceWith('/v1/events/rsvps/rsvp-1');
      done();
    });
  });

  it('loads the attendee list for one event', done => {
    const response: EventRsvpAttendeesResponse = {
      eventPublicId: 'rsvp-1',
      eventTitle: rsvp.title,
      totalCount: 1,
      attendees: [{
        memberName: '김철수',
        groupName: '믿음',
        groupDivision: '느헤미야',
        checkedInAt: '2026-07-12T00:05:00.000Z',
      }],
    };
    api.get.and.returnValue(of(response));

    service.getAttendees(rsvp.publicId).subscribe(result => {
      expect(result).toBe(response);
      expect(api.get).toHaveBeenCalledOnceWith('/v1/events/rsvps/rsvp-1/attendees');
      done();
    });
  });
});
