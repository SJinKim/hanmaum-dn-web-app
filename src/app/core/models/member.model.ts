import { UserTraining, MinistryHistory, SummaryTraining } from './member-activity.model';

/** Lightweight DTO — used in list view */
export interface MemberSummary {
  publicId: string;
  lastName: string;
  firstName: string;
  email: string | null;
  memberStatus: MemberStatus;
  baptism: Baptism | null;
  groupPublicId?: string | null;
  groupName: string | null;
  churchRole?: string | null;
  role?: 'ADMIN' | 'MEMBER';
  updatedAt?: string;
  /** Latest completed training name (highest sort order), or null. */
  latestTraining?: string | null;
  /** All trainings, ordered by progression — rendered as chips in the grid. */
  trainings?: SummaryTraining[];
  /** Names of currently-active ministries — rendered as chips in the grid. */
  activeMinistries?: string[];
  isNextGroupLeader?: boolean;
  oneOnOneSignupFilled?: boolean;
}

/** Full detail DTO — used in detail + edit views */
export interface Member {
  publicId: string;
  lastName: string;
  firstName: string;
  discriminator: string | null;
  gender: Gender | null;
  baptism: Baptism | null;
  birthDate: string | null;       // ISO date string
  phoneNumber: string | null;
  email: string | null;
  street: string | null;
  houseNumber: string | null;
  zipCode: string | null;
  city: string | null;
  registrationDate: string | null;
  memberStatus: MemberStatus;
  role?: 'ADMIN' | 'MEMBER';
  churchRole: string | null;
  /** publicId of the member's church group — used to pre-select the group on edit. */
  groupPublicId: string | null;
  groupName: string | null;
  profileImageUrl: string | null;
  isNextGroupLeader?: boolean;
  oneOnOneSignupFilled?: boolean;
  /**
   * Training history — persisted, sent by `GET /members/{id}`. Edited via
   * `PUT /members/{id}/trainings`. See member-activity.model.ts.
   */
  trainings?: UserTraining[];
  /** Ministry assignment history (start/end dates) — edited via `PUT /members/{id}/ministries`. */
  ministries?: MinistryHistory[];
}

export interface CreateMemberRequest {
  lastName: string;
  firstName: string;
  discriminator?: string;
  gender?: Gender;
  baptism?: Baptism;
  birthDate?: string;
  phoneNumber?: string;
  email?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  registrationDate?: string;
  churchRole?: string;
  /** publicId of the church group to assign. */
  groupPublicId?: string;
  profileImageUrl?: string;
}

/** All fields optional — PATCH semantics */
export interface UpdateMemberRequest {
  lastName?: string;
  firstName?: string;
  discriminator?: string;
  gender?: Gender;
  baptism?: Baptism;
  birthDate?: string;
  phoneNumber?: string;
  email?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  registrationDate?: string;
  memberStatus?: MemberStatus;
  churchRole?: string;
  /** publicId of the church group to assign. */
  groupPublicId?: string;
  profileImageUrl?: string;
  isNextGroupLeader?: boolean;
  oneOnOneSignupFilled?: boolean;
}

/** Church group option for selection dropdowns (from GET /v1/church-groups). */
export interface ChurchGroupSummary {
  publicId: string;
  division: string | null;
  name: string;
}

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'DELETED';
export type Gender      = 'M' | 'F';
export type Baptism     = 'UNBAPTIZED' | 'INFANT_BAPTIZED' | 'CONFIRMATION' | 'GENERAL_BAPTIZED';

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  PENDING:  '대기중',
  ACTIVE:   '활성',
  INACTIVE: '비활성',
  DELETED:  '삭제됨',
};

export const GENDER_LABELS: Record<Gender, string> = {
  M: '형제',
  F: '자매',
};

export const BAPTISM_LABELS: Record<Baptism, string> = {
  UNBAPTIZED:      '미세례',
  INFANT_BAPTIZED: '유아세례',
  CONFIRMATION:    '입교',
  GENERAL_BAPTIZED:'세례',
};

export const MEMBER_STATUS_OPTIONS = Object.entries(MEMBER_STATUS_LABELS)
  .filter(([k]) => k !== 'DELETED')            // DELETED only via delete endpoint
  .map(([value, label]) => ({ value, label }));

export const GENDER_OPTIONS = Object.entries(GENDER_LABELS)
  .map(([value, label]) => ({ value, label }));

export const BAPTISM_OPTIONS = Object.entries(BAPTISM_LABELS)
  .map(([value, label]) => ({ value, label }));
