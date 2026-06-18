import { EventRsvpDto, eventRsvpStatus } from './event-rsvp.model';

describe('eventRsvpStatus', () => {
  const rsvp: EventRsvpDto = {
    publicId: 'rsvp-1',
    title: '여름 수련회',
    windowStart: '2026-07-12T09:00:00+09:00',
    windowEnd: '2026-07-12T12:00:00+09:00',
    isActive: true,
    announcementPublicId: null,
  };

  it('returns INACTIVE before evaluating the time window', () => {
    expect(eventRsvpStatus({ ...rsvp, isActive: false }, new Date('2026-07-12T01:00:00Z')))
      .toBe('INACTIVE');
  });

  it('returns SCHEDULED before the start', () => {
    expect(eventRsvpStatus(rsvp, new Date('2026-07-11T23:59:59Z'))).toBe('SCHEDULED');
  });

  it('returns OPEN within the half-open RSVP window', () => {
    expect(eventRsvpStatus(rsvp, new Date('2026-07-12T00:00:00Z'))).toBe('OPEN');
    expect(eventRsvpStatus(rsvp, new Date('2026-07-12T02:59:59Z'))).toBe('OPEN');
  });

  it('returns CLOSED at and after the end', () => {
    expect(eventRsvpStatus(rsvp, new Date('2026-07-12T03:00:00Z'))).toBe('CLOSED');
  });
});
