/** Lightweight DTO — used in list view */
export interface MemberSummary {
  publicId: string;
  lastName: string;
  firstName: string;
  email: string | null;
  memberStatus: MemberStatus;
  baptism: Baptism | null;
  groupName: string | null;
  role?: 'ADMIN' | 'MEMBER';
  updatedAt?: string;
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
  zipCode: string | null;
  city: string | null;
  registrationDate: string | null;
  memberStatus: MemberStatus;
  role?: 'ADMIN' | 'MEMBER';
  churchRole: string | null;
  groupName: string | null;
  profileImageUrl: string | null;
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
  zipCode?: string;
  city?: string;
  registrationDate?: string;
  churchRole?: string;
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
  zipCode?: string;
  city?: string;
  registrationDate?: string;
  memberStatus?: MemberStatus;
  churchRole?: string;
  profileImageUrl?: string;
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
