export interface MinistrySummary {
  publicId: string;
  name: string;
  shortDescription: string;
  imageUrl: string | null;
  leaderName: string | null;
  isActive: boolean;
}

export interface Ministry {
  publicId: string;
  name: string;
  shortDescription: string;
  longDescription: string | null;
  imageUrl: string | null;
  leader: LeaderDto | null;
  isActive: boolean;
}

export interface LeaderDto {
  publicId: string;
  fullName: string;
}

export interface RegistrationDto {
  publicId: string;
  ministryPublicId: string;
  memberPublicId: string;
  memberName: string;
  registrationPeriod: string;
  note: string | null;
}

export interface ActiveMinistryMemberDto {
  publicId: string;   // member public ID
  fullName: string;
  startDate: string;  // 'YYYY-MM-DD'
  note: string | null;
  gender: 'M' | 'F' | null;
}

export interface CreateMinistryRequest {
  name: string;
  shortDescription: string;
  longDescription?: string;
  imageUrl?: string;
  leaderPublicId?: string;
}

export interface UpdateMinistryRequest {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  imageUrl?: string;
  leaderPublicId?: string;
  isActive?: boolean;
}
