import { BadgeVariant } from '../../core/ui/variant-tokens';

export type AnnouncementCategory = 'NOTICE' | 'MINISTRY' | 'EVENT';

/** Order of the 카테고리 chips and select options, as in Figma 222:9396. */
export const ANNOUNCEMENT_CATEGORIES: readonly AnnouncementCategory[] = ['NOTICE', 'MINISTRY', 'EVENT'];

/** Figma: 공지 gray, 사역 blue, 행사 violet. */
export const ANNOUNCEMENT_CATEGORY_BADGE: Record<AnnouncementCategory, BadgeVariant> = {
  NOTICE:   'neutral',
  MINISTRY: 'ministry-active',
  EVENT:    'pending',
};

export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  startAt: string;       // ISO OffsetDateTime
  endAt: string | null;  // ISO OffsetDateTime
  imageUrl?: string | null;
  location?: string | null;
  viewCount?: number;
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
  /** Not in the web form; sent back unchanged so a PUT does not clear it. */
  imageUrl?: string | null;
  location?: string | null;
  isPinned: boolean;
}

/** 고정 first, then the newest 시작일. */
export function sortAnnouncements(items: AnnouncementDto[]): AnnouncementDto[] {
  return [...items].sort((a, b) =>
    Number(b.isPinned) - Number(a.isPinned) || b.startAt.localeCompare(a.startAt));
}

/** "2026.09.14" — the 게시 기간 in Figma is whole days. */
export function formatAnnouncementDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
