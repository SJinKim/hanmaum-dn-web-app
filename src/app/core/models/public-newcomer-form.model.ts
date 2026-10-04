import { Baptism, Gender } from './member.model';
import { ChurchExperience } from './newcomer.model';

/** `GET /v1/newcomer-forms/{token}` — what a visitor needs before filling in the form. */
export interface PublicNewcomerFormMetadata {
  expiresAt: string;
  consentVersion: string;
}

/** `PublicNewcomerSubmissionRequest`; `consentAccepted` must be true, `honeypot` blank. */
export interface PublicNewcomerSubmissionRequest {
  lastName: string;
  firstName: string;
  englishName: string;
  gender?: Gender;
  birthDate?: string;
  phoneNumber?: string;
  email?: string;
  kakaoId?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  churchExperience?: ChurchExperience;
  baptism?: Baptism;
  previousChurch?: string;
  visitMotives: string[];
  consentAccepted: boolean;
  honeypot?: string;
}

/** `PublicNewcomerSubmissionResponse`. */
export interface PublicNewcomerSubmissionResponse {
  newcomerPublicId: string;
  submittedAt: string;
}

/**
 * Figma: 새가족 등록 (공개) — the six 방문 동기. The Korean label is what the
 * server stores, in either UI language; `OTHER` is sent as "기타: …".
 */
export const VISIT_MOTIVES = [
  { id: 'REFERRAL',  value: '지인의 소개로' },
  { id: 'MOVED',     value: '교회 근처로 이사와서 찾아옴' },
  { id: 'ANSWER',    value: '하나님께서 속히 나에게 답해 주고 싶어서' },
  { id: 'COMMUNITY', value: '친밀 공동체가 기대되어' },
  { id: 'RECOVERY',  value: '신앙의 회복을 소망해서' },
  { id: 'OTHER',     value: '기타' },
] as const;

export type VisitMotiveId = (typeof VISIT_MOTIVES)[number]['id'];
