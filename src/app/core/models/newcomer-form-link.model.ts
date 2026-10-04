// QR 등록 링크 (#44), mirrors `FormLinkResponse` of `NewcomerFormLinkController` (hanmaum-dn-server #182).

export interface NewcomerFormLink {
  publicId: string;
  /** ISO instant. */
  expiresAt: string;
  revokedAt?: string | null;
  /** Neither expired nor revoked — computed by the server. */
  active: boolean;
  useCount: number;
  /** Only in the create response; the server keeps a hash and never returns it again. */
  token?: string | null;
}

export interface CreateNewcomerFormLinkRequest {
  /** Omitted: the server uses now + 12 h. At most now + 24 h. */
  expiresAt?: string;
}

export type FormLinkStatus = 'active' | 'expired' | 'revoked';

/** 활성 / 만료 / 취소; revocation wins over expiry. */
export function formLinkStatus(link: Pick<NewcomerFormLink, 'active' | 'revokedAt'>): FormLinkStatus {
  if (link.revokedAt) return 'revoked';
  return link.active ? 'active' : 'expired';
}

/** The 유효 기간 choices in hours; the server rejects more than 24. */
export const FORM_LINK_DURATIONS: readonly number[] = [2, 4, 6, 12, 24];
export const FORM_LINK_DEFAULT_HOURS = 12;

/** The public 새가족 등록 route (#42) the QR code opens. */
export function formLinkUrl(origin: string, token: string): string {
  return `${origin}/register/${encodeURIComponent(token)}`;
}
