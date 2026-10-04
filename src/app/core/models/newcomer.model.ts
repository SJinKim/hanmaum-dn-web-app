import { Baptism, Gender } from './member.model';

/**
 * 새가족 (#41, #43) — the shapes of `hanmaum-dn-ops/api/openapi.yaml`
 * (`NewcomerResponse`, `CreateNewcomerRequest`, `UpdateNewcomerRequest`,
 * `NewcomerOptionsResponse`, `GraduateNewcomerRequest`). Labels are not here:
 * every enum resolves through ngx-translate under `newcomers.*`.
 */

export type NewcomerLifecycleStatus = 'SUBMITTED' | 'IN_CARE' | 'GRADUATED' | 'ARCHIVED';

export type NewcomerIdentityStatus =
  | 'EMPLOYEE'
  | 'UNIVERSITY_STUDENT'
  | 'EXAM_PREPARATION'
  | 'WORKING_HOLIDAY'
  | 'EXCHANGE_STUDENT'
  | 'SELF_EMPLOYED'
  | 'EXPATRIATE'
  | 'JOB_SEEKING';

export type PostAssignmentAttendance =
  | 'REGULAR'
  | 'OCCASIONAL'
  | 'WORSHIP_ONLY'
  | 'ABSENT_OVER_MONTH'
  | 'CHANGED_CHURCH'
  | 'RETURNED_OR_MOVED';

export type ChurchExperience = 'FIRST_TIME' | 'CHILDHOOD_FEW_TIMES' | 'IRREGULAR' | 'REGULAR';

export const NEWCOMER_LIFECYCLE_STATUSES: readonly NewcomerLifecycleStatus[] = [
  'SUBMITTED', 'IN_CARE', 'GRADUATED', 'ARCHIVED',
];

export const NEWCOMER_IDENTITY_STATUSES: readonly NewcomerIdentityStatus[] = [
  'EMPLOYEE', 'UNIVERSITY_STUDENT', 'EXAM_PREPARATION', 'WORKING_HOLIDAY',
  'EXCHANGE_STUDENT', 'SELF_EMPLOYED', 'EXPATRIATE', 'JOB_SEEKING',
];

export const POST_ASSIGNMENT_ATTENDANCES: readonly PostAssignmentAttendance[] = [
  'REGULAR', 'OCCASIONAL', 'WORSHIP_ONLY', 'ABSENT_OVER_MONTH', 'CHANGED_CHURCH', 'RETURNED_OR_MOVED',
];

export const CHURCH_EXPERIENCES: readonly ChurchExperience[] = [
  'FIRST_TIME', 'CHILDHOOD_FEW_TIMES', 'IRREGULAR', 'REGULAR',
];

/** A caregiver or a 순 as the newcomer endpoints hand it out. */
export interface NewcomerOption {
  publicId: string;
  label: string;
}

export interface Newcomer {
  publicId: string;
  memberPublicId: string | null;
  lastName: string;
  firstName: string;
  gender: Gender | null;
  birthDate: string | null;
  email: string | null;
  phoneNumber: string | null;
  street: string | null;
  houseNumber: string | null;
  zipCode: string | null;
  city: string | null;
  baptism: Baptism | null;
  profileImageUrl: string | null;
  registrationDate: string | null;
  intakeRound: number | null;
  hasVisited: boolean | null;
  lifecycleStatus: NewcomerLifecycleStatus | null;
  caregiver: NewcomerOption | null;
  identityStatus: NewcomerIdentityStatus | null;
  workOrSchool: string | null;
  firstVisitDate: string | null;
  assignedGroup: NewcomerOption | null;
  assignmentReason: string | null;
  overallNotes: string | null;
  postAssignmentAttendance: PostAssignmentAttendance | null;
  kakaoId: string | null;
  previousChurch: string | null;
  churchExperience: ChurchExperience | null;
  visitMotives: string[] | null;
  additionalNotes: string | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** `CreateNewcomerRequest`: only the name is required. */
export interface CreateNewcomerRequest {
  lastName: string;
  firstName: string;
  gender?: Gender;
  birthDate?: string;
  email?: string;
  phoneNumber?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  baptism?: Baptism;
  registrationDate?: string;
  intakeRound?: number;
  hasVisited?: boolean;
  lifecycleStatus?: NewcomerLifecycleStatus;
  caregiverPublicId?: string;
  identityStatus?: NewcomerIdentityStatus;
  workOrSchool?: string;
  firstVisitDate?: string;
  assignedGroupPublicId?: string;
  assignmentReason?: string;
  overallNotes?: string;
  postAssignmentAttendance?: PostAssignmentAttendance;
  kakaoId?: string;
  previousChurch?: string;
  churchExperience?: ChurchExperience;
  visitMotives?: string[];
  additionalNotes?: string;
}

/** `UpdateNewcomerRequest`: a PATCH guarded by the optimistic-lock `version`. */
export interface UpdateNewcomerRequest extends Partial<CreateNewcomerRequest> {
  version: number;
}

export interface NewcomerOptions {
  caregivers: NewcomerOption[];
  groups: NewcomerOption[];
  identityStatuses: NewcomerIdentityStatus[];
  attendanceStatuses: PostAssignmentAttendance[];
}

/** `GraduateNewcomerRequest` — 등반: the newcomer joins a 순 as a member. */
export interface GraduateNewcomerRequest {
  groupPublicId: string;
  cohortNumber?: number;
  graduatedAt?: string;
  assignmentReason?: string;
}

export interface NewcomerGraduation {
  publicId: string;
  newcomerPublicId: string;
  memberPublicId: string | null;
  groupPublicId: string | null;
  cohortNumber: number | null;
  cohortLabel: string | null;
  graduatedOn: string | null;
  assignmentReason: string | null;
}

/** The columns `GET /newcomers` sorts by (`NewcomerService.comparator`). */
export type NewcomerSortProperty = 'name' | 'registrationDate';
