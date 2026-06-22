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
}

export interface ActiveMinistryMemberDto {
  publicId: string;   // member public ID
  fullName: string;
  startDate: string;  // 'YYYY-MM-DD'
  note: string | null;
  gender: 'M' | 'F' | null;
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
