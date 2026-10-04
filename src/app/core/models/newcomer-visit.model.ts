import { Gender } from './member.model';
import { NewcomerLifecycleStatus } from './newcomer.model';

// 방문 기록 (#40), mirrors `NewcomerVisitDtos.kt` of hanmaum-dn-server #262.

export type NewcomerVisitType = 'FIRST' | 'REVISIT';

/** 알게 된 경로 — drives the 광고 evaluation. */
export type NewcomerVisitSource =
  | 'FRIEND_FAMILY'
  | 'ADVERTISEMENT'
  | 'SOCIAL_MEDIA'
  | 'WEBSITE'
  | 'WALK_IN'
  | 'OTHER';

export const NEWCOMER_VISIT_SOURCES: readonly NewcomerVisitSource[] = [
  'FRIEND_FAMILY',
  'ADVERTISEMENT',
  'SOCIAL_MEDIA',
  'WEBSITE',
  'WALK_IN',
  'OTHER',
];

export interface NewcomerVisit {
  publicId: string;
  visitDate: string;
  lastName: string;
  firstName: string;
  fullName: string;
  gender: Gender | null;
  birthYear: number | null;
  visitType: NewcomerVisitType;
  source: NewcomerVisitSource | null;
  note: string | null;
  /** Set once the visitor registered as 새가족. */
  newcomerPublicId: string | null;
  newcomerLifecycle: NewcomerLifecycleStatus | null;
  createdAt: string;
}

export interface CreateNewcomerVisitRequest {
  /** Defaults to today on the server. */
  visitDate?: string;
  lastName: string;
  firstName: string;
  gender?: Gender;
  birthYear?: number;
  visitType?: NewcomerVisitType;
  source?: NewcomerVisitSource;
  note?: string;
}

/** PATCH: an omitted field stays as it is. */
export type UpdateNewcomerVisitRequest = Partial<CreateNewcomerVisitRequest>;

export interface NewcomerVisitStats {
  from: string;
  to: string;
  visits: number;
  firstVisits: number;
  revisits: number;
  registered: number;
  graduated: number;
  bySource: readonly { source: NewcomerVisitSource | null; count: number }[];
  byDay: readonly { date: string; count: number }[];
}
