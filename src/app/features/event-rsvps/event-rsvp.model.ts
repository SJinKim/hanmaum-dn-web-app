export interface EventRsvpDto {
  publicId: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  isActive: boolean;
  announcementPublicId: string | null;
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
