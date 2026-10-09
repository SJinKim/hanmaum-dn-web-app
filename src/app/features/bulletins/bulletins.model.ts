/** 주보 (#36) — shapes of `/v1/admin/bulletins` in `hanmaum-dn-ops/api/openapi.yaml`. */

export type BulletinStatus = 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN';

export type BulletinSectionKey =
  | 'SECTION_WORSHIP'
  | 'SECTION_OFFERING'
  | 'SECTION_SENDING'
  | 'FIXED_BLESSING_PRAYER';

export type BulletinSharingBlockType = 'HEADING' | 'PARAGRAPH' | 'SCRIPTURE' | 'QUESTION';

export interface BulletinAnnouncement {
  title: string;
  body?: string | null;
}

export interface BulletinSharingBlock {
  type: BulletinSharingBlockType;
  text: string;
  reference?: string | null;
}

export interface BulletinSectionTitle {
  key: BulletinSectionKey;
  title: string;
  defaultTitle: string;
}

export interface BulletinService {
  publicId: string;
  name: string;
  startTime: string;
  sortOrder: number;
  active: boolean;
  isBulletinDefault: boolean;
}

export interface BulletinSundayOption {
  serviceDate: string;
  editionPublicId: string | null;
  status: BulletinStatus | null;
}

export interface BulletinDefaults {
  serviceDate: string;
  service: BulletinService;
  sundays: BulletinSundayOption[];
  nextFrom: string;
}

/** `BulletinServiceRequest` — 예배 추가 and 수정 send the whole service. */
export interface BulletinServiceRequest {
  name: string;
  /** LocalTime, "HH:mm:ss". */
  startTime: string;
  sortOrder?: number;
  active?: boolean;
  /** true moves the default to this service. */
  isBulletinDefault?: boolean;
}

/** Empty or null resets the title to its default. */
export interface UpdateSectionTitleRequest {
  title: string | null;
}

/** The fixed order of the four titles in the 섹션 제목 card. */
export const BULLETIN_SECTION_KEYS: readonly BulletinSectionKey[] = [
  'SECTION_WORSHIP',
  'SECTION_OFFERING',
  'SECTION_SENDING',
  'FIXED_BLESSING_PRAYER',
];

export interface BulletinEditionSummary {
  publicId: string;
  serviceDate: string;
  volume: number | null;
  status: BulletinStatus;
  sermonTitle: string | null;
  serviceName: string | null;
  publishedAt: string | null;
}

/** The content fields of an edition, shared by the response and the update request. */
export interface BulletinContent {
  openingPrayerBy: string | null;
  offeringSongBy: string | null;
  scriptureReference: string | null;
  sermonTitle: string | null;
  sermonPreacher: string | null;
  responsePrayerBy: string | null;
  responseSong: string | null;
  songs: string[];
  announcements: BulletinAnnouncement[];
  sharingBlocks: BulletinSharingBlock[];
}

export interface BulletinEdition extends BulletinContent {
  publicId: string;
  serviceDate: string;
  volume: number | null;
  status: BulletinStatus;
  servicePublicId: string;
  serviceName: string | null;
  serviceStartTime: string | null;
  sectionTitles: BulletinSectionTitle[];
  publishedAt: string | null;
  withdrawnAt: string | null;
  version: number;
}

export interface CreateBulletinRequest {
  serviceDate?: string;
  servicePublicId?: string;
  /** Edition whose content the new draft takes over, usually last week's. */
  copyFrom?: string;
}

/** Full replacement of a draft's content; a stale `version` is a 409. */
export interface UpdateBulletinRequest extends BulletinContent {
  version: number;
}

/** Server limits from `UpdateBulletinRequest`. */
export const BULLETIN_LIMITS = {
  songs: 8,
  announcements: 20,
  shortText: 100,
  longText: 200,
  announcementBody: 2000,
  sharingBlocks: 50,
  sharingText: 2000,
  sharingReference: 100,
} as const;

/** The fields a 422 `BULLETIN_INCOMPLETE` names in `fieldErrors`. */
export type BulletinRequiredField = 'sermonTitle' | 'sermonPreacher' | 'songs';

export const BULLETIN_STATUS_BADGE = {
  DRAFT: 'pending',
  PUBLISHED: 'active',
  WITHDRAWN: 'training-progress',
} as const satisfies Record<BulletinStatus, string>;

/** `2026-10-11` → `2026-10-11 (주일)` per Figma; the suffix comes from i18n. */
export function formatServiceDate(date: string, sundayLabel: string): string {
  return `${date} (${sundayLabel})`;
}
