import { DayOfWeek } from '../attendance/attendance.model';

export interface MinistrySummary {
  publicId: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  contacts: MinistryContact[];
  isActive: boolean;
}

export interface Ministry {
  publicId: string;
  title: string;
  subtitle: string;
  about: string;
  requirements: string[];
  schedules: MinistrySchedule[];
  contacts: MinistryContact[];
  imageUrl: string | null;
  isActive: boolean;
}

export interface MinistryContact {
  role: string;
  name: string;
}

export interface MinistrySchedule {
  description: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  /** Optional weekday the schedule repeats on. */
  dayOfWeek?: DayOfWeek | null;
}

export type MinistryAssignmentRole = 'LEADER' | 'SUB_LEADER' | 'MEMBER';
export type MinistryAssignmentStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';

/** One assignment from `GET /v1/ministries/{publicId}/members`. */
export interface ActiveMinistryMemberDto {
  publicId: string;   // member public ID
  fullName: string;
  startDate: string;  // 'YYYY-MM-DD'
  note: string | null;
  gender: 'M' | 'F' | null;
  role?: MinistryAssignmentRole;
  status?: MinistryAssignmentStatus;
  endDate?: string | null;  // 'YYYY-MM-DD'; set only with `includeEnded`
  /** Set on a self-application (HDN-170): what the applicant wrote to the leader. */
  selfIntroduction?: string | null;
  /** When the self-application was sent (ISO date-time). */
  appliedAt?: string | null;
}

export type MinistryReviewDecision = 'APPROVE' | 'REJECT';

/** Body for `PATCH /v1/ministries/{publicId}/applications/{memberPublicId}`. */
export interface ReviewMinistryApplicationRequest {
  decision: MinistryReviewDecision;
  /** Required for REJECT — the applicant reads it in the app. */
  message?: string | null;
}

/** Response of the review: the application after the decision. */
export interface MinistryRegistrationDto {
  ministryPublicId: string;
  ministryName: string;
  appliedAt: string | null;
  status: MinistryAssignmentStatus;
  leaderNotified: boolean;
  rejectionMessage: string | null;
}

export interface CreateMinistryRequest {
  title: string;
  subtitle: string;
  about: string;
  requirements: string[];
  schedules: MinistrySchedule[];
  contacts: MinistryContact[];
  imageUrl: string | null;
}

export interface UpdateMinistryRequest {
  title: string;
  subtitle: string;
  about: string;
  requirements: string[];
  schedules: MinistrySchedule[];
  contacts: MinistryContact[];
  imageUrl: string;
  isActive: boolean;
}

/** Lightweight 맴버 entry for the add-member picker (`GET /v1/members/names`). */
export interface MemberNameDto {
  publicId: string;
  fullName: string;
  discriminator: string | null;
}

/** Body for `POST /v1/ministries/{publicId}/members`. */
export interface AddMinistryMemberRequest {
  memberId: string;
  startDate?: string | null;  // 'YYYY-MM-DD'; omit/null ⇒ backend uses current month
  note?: string | null;
}
