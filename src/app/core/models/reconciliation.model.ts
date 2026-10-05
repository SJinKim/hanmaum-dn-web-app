// 계정 연결 확인 (#45), mirrors `ReconciliationResponse` of `MemberReconciliationController`.

import { MemberOrigin } from './member.model';

export type ReconciliationStatus = 'OPEN' | 'LINKED' | 'DISMISSED';

export const RECONCILIATION_STATUSES: readonly ReconciliationStatus[] = ['OPEN', 'LINKED', 'DISMISSED'];

/** Why the server could not decide on its own. */
export type ReconciliationReason =
  | 'EMAIL_MATCH_IDENTITY_MISMATCH'
  | 'PROFILE_VALUE_CONFLICT'
  | 'POSSIBLE_NAME_BIRTH_MATCH'
  | 'MULTIPLE_CANDIDATES'
  | 'FORM_EMAIL_MATCH';

export interface ReconciliationMember {
  publicId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** ISO date. */
  birthDate?: string | null;
  phoneNumber?: string | null;
  /** Has a Keycloak account. */
  linked: boolean;
  /** From Keycloak; null without an account or when Keycloak could not be asked (#182). */
  emailVerified?: boolean | null;
  /** How the member record came to exist (#182). */
  origin?: MemberOrigin;
}

export interface Reconciliation {
  publicId: string;
  status: ReconciliationStatus;
  reasons: string[];
  /** Server field names, e.g. `phoneNumber`, `zipCode`, `baptism`. */
  conflictFields: string[];
  registrationMember: ReconciliationMember;
  candidates: ReconciliationMember[];
  selectedMemberPublicId?: string | null;
  /** Optimistic lock — every resolve sends the version it was shown. */
  version: number;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface ResolveReconciliationRequest {
  memberPublicId: string;
  version: number;
}

/** The fields compared side by side; the response carries no others. */
export const RECONCILIATION_FIELDS = ['name', 'email', 'birthDate', 'phoneNumber'] as const;
export type ReconciliationField = (typeof RECONCILIATION_FIELDS)[number];

export function reconciliationValue(m: ReconciliationMember, field: ReconciliationField): string {
  if (field === 'name') return `${m.lastName ?? ''}${m.firstName ?? ''}`.trim();
  return m[field]?.trim() ?? '';
}

/**
 * What a failed resolve means, read from the server's message — the 409s share
 * one status and differ only in text (`MemberReconciliationService`).
 */
export type ReconciliationError =
  | 'resolved'
  | 'stale'
  | 'useMerge'
  | 'alreadyLinked'
  | 'registrationUnlinked'
  | 'memberInactive'
  | 'notCandidate'
  | 'notFound'
  | 'failed';

export function reconciliationError(status: number, message: string | null | undefined): ReconciliationError {
  const m = (message ?? '').toLowerCase();
  if (status === 404) return 'notFound';
  if (status === 409) {
    if (m.includes('already been resolved')) return 'resolved';
    if (m.includes('reload and retry')) return 'stale';
    if (m.includes('merge action')) return 'useMerge';
    if (m.includes('already linked to another')) return 'alreadyLinked';
    if (m.includes('no longer linked')) return 'registrationUnlinked';
  }
  if (status === 400) {
    if (m.includes('no longer active')) return 'memberInactive';
    if (m.includes('not a current candidate')) return 'notCandidate';
  }
  return 'failed';
}
