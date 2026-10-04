import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { PageResponse } from '../../core/models/api-response.model';
import { MemberSummary } from '../../core/models/member.model';
import { EventRsvpService } from '../event-rsvps/event-rsvp.service';
import { MemberService } from '../members/member.service';
import { MinistryService } from '../ministry/ministry.service';
import { HomeService } from './home.service';

function page(totalElements: number): PageResponse<MemberSummary> {
  return { content: [], totalElements, totalPages: 1, number: 0, size: 1 };
}

/** What `/events/rsvps/active` answers an account without a member row. */
const NO_MEMBER_PROFILE = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });

describe('HomeService — snapshot (#93)', () => {
  let service: HomeService;
  let members: jasmine.SpyObj<MemberService>;
  let ministries: jasmine.SpyObj<MinistryService>;
  let rsvps: jasmine.SpyObj<EventRsvpService>;

  beforeEach(() => {
    members = jasmine.createSpyObj<MemberService>('MemberService', ['getMembers']);
    ministries = jasmine.createSpyObj<MinistryService>('MinistryService', ['getMinistries']);
    rsvps = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['getActiveRsvps', 'getRsvps']);

    members.getMembers.and.callFake(params =>
      of(page(params.status === 'PENDING' ? 3 : params.status === 'ACTIVE' ? 28 : 32)),
    );
    ministries.getMinistries.and.returnValue(of([]));
    rsvps.getActiveRsvps.and.returnValue(of([]));
    rsvps.getRsvps.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: MemberService, useValue: members },
        { provide: MinistryService, useValue: ministries },
        { provide: EventRsvpService, useValue: rsvps },
      ],
    });
    service = TestBed.inject(HomeService);
  });

  it('keeps 승인 대기 when /events/rsvps/active answers 404', async () => {
    rsvps.getActiveRsvps.and.returnValue(throwError(() => NO_MEMBER_PROFILE));

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.pendingApprovals).toBe(3);
    expect(snapshot.overview.totalMembers).toBe(32);
    expect(snapshot.overview.activeMembers).toBe(28);
    expect(snapshot.awaitingRsvps).toBeNull();
  });

  it('marks only the failed count as unavailable, never as 0', async () => {
    ministries.getMinistries.and.returnValue(throwError(() => new Error('boom')));

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.overview.ministries).toBeNull();
    expect(snapshot.awaitingRsvps).toBe(0);
    expect(snapshot.pendingApprovals).toBe(3);
  });

  it('falls back to empty lists when their source fails', async () => {
    rsvps.getRsvps.and.returnValue(throwError(() => new Error('boom')));
    members.getMembers.and.callFake(params =>
      params.size === 1 ? of(page(3)) : throwError(() => new Error('boom')),
    );

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.upcomingEvents).toEqual([]);
    expect(snapshot.recentActivity).toEqual([]);
    expect(snapshot.pendingApprovals).toBe(3);
  });
});
