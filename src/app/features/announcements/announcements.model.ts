export type AnnouncementCategory = 'NOTICE' | 'MINISTRY' | 'EVENT';

export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  startAt: string;       // ISO OffsetDateTime
  endAt: string | null;  // ISO OffsetDateTime
  isPinned: boolean;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  category: AnnouncementCategory;
  startAt: string;       // ISO OffsetDateTime
  endAt?: string | null;
  isPinned?: boolean;
}

export interface UpdateAnnouncementRequest {
  title: string;
  body: string;
  category: AnnouncementCategory;
  startAt: string;       // ISO OffsetDateTime
  endAt: string | null;
  isPinned: boolean;
}

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  NOTICE:   'Notice',
  MINISTRY: 'Ministry',
  EVENT:    'Event',
};

export const ANNOUNCEMENT_CATEGORY_OPTIONS =
  (Object.entries(ANNOUNCEMENT_CATEGORY_LABELS) as [AnnouncementCategory, string][])
    .map(([value, label]) => ({ value, label }));
