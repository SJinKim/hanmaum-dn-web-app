import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse } from '../models/api-response.model';

/** The parts of a server `ErrorResponse` a client may act on. */
export interface ApiError {
  readonly status: number;
  readonly code: string | null;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

/**
 * Reads `code` and `fieldErrors` from a failed request. Anything that is not an
 * `HttpErrorResponse` (a thrown bug, a timeout) yields null.
 *
 * Only `code` is meant to be branched on — `message` is server prose and may
 * change wording at any time (hanmaum-dn-web-app#225).
 */
export function readApiError(err: unknown): ApiError | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body = (typeof err.error === 'object' && err.error !== null ? err.error : {}) as Partial<ApiErrorResponse>;
  return {
    status: err.status,
    code: typeof body.code === 'string' ? body.code : null,
    fieldErrors: body.fieldErrors && typeof body.fieldErrors === 'object' ? body.fieldErrors : {},
  };
}

/** What a known error code means to the UI. */
export interface ApiErrorMapping {
  /** i18n key of the message shown at the field and in the toast. */
  readonly messageKey: string;
  /** Form control the error belongs to, when the code is about one field. */
  readonly field?: string;
}

/**
 * Server error code → i18n. A code missing here is unknown to the web app and
 * falls back to the caller's generic toast.
 */
export const API_ERROR_I18N: Readonly<Record<string, ApiErrorMapping>> = {
  // hanmaum-dn-server#314: an ACTIVE member must belong to a 순.
  MEMBER_GROUP_REQUIRED: { messageKey: 'members.edit.errors.groupRequired', field: 'groupPublicId' },
};

/** The mapping for a failed request, or null when its code is unknown. */
export function mapApiError(err: unknown): (ApiErrorMapping & { readonly code: string }) | null {
  const code = readApiError(err)?.code;
  if (!code) return null;
  const mapping = API_ERROR_I18N[code];
  return mapping ? { code, ...mapping } : null;
}
