export interface EventRsvpDto {
  publicId: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  isActive: boolean;
  announcementPublicId: string | null;
}

/**
 * `GET /api/v1/events/rsvps/active` — `ActiveEventRsvpDto` in
 * `../hanmaum-dn-ops/api/openapi.yaml`. `myStatus` is the caller's own answer, so
 * `null` is "응답 대기" (has not replied yet).
 */
export interface ActiveEventRsvpDto {
  publicId: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  announcementId: string | null;
  myStatus: 'GOING' | 'NOT_GOING' | 'MAYBE' | null;
  respondedAt: string | null;
  nextReminderAt: string | null;
}

export interface CreateEventRsvpRequest {
  title: string;
  windowStart: string;
  windowEnd: string;
  announcementId?: string;
}

export interface UpdateEventRsvpRequest {
  title?: string;
  windowStart?: string;
  windowEnd?: string;
  isActive?: boolean;
  announcementId?: string;
}

export interface EventAnnouncementOption {
  id: string;
  title: string;
}

export interface EventRsvpAttendee {
  memberName: string;
  groupName: string | null;
  groupDivision: string | null;
  checkedInAt: string;
}

export interface EventRsvpAttendeesResponse {
  eventPublicId: string;
  eventTitle: string;
  totalCount: number;
  attendees: EventRsvpAttendee[];
}

export type EventRsvpStatus = 'OPEN' | 'SCHEDULED' | 'CLOSED' | 'INACTIVE';

export function eventRsvpStatus(
  rsvp: EventRsvpDto,
  now = new Date(),
): EventRsvpStatus {
  if (!rsvp.isActive) return 'INACTIVE';
  if (now < new Date(rsvp.windowStart)) return 'SCHEDULED';
  if (now >= new Date(rsvp.windowEnd)) return 'CLOSED';
  return 'OPEN';
}
