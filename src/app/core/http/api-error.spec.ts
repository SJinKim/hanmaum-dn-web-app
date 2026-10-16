import { HttpErrorResponse } from '@angular/common/http';

import { mapApiError, readApiError } from './api-error';

describe('api-error', () => {
  const groupRequired = new HttpErrorResponse({
    status: 400,
    error: {
      status: 400,
      error: 'Bad Request',
      message: 'whatever the server says',
      code: 'MEMBER_GROUP_REQUIRED',
      fieldErrors: { groupPublicId: 'required' },
    },
  });

  it('reads code and fieldErrors from an HttpErrorResponse', () => {
    expect(readApiError(groupRequired)).toEqual({
      status: 400,
      code: 'MEMBER_GROUP_REQUIRED',
      fieldErrors: { groupPublicId: 'required' },
    });
  });

  it('returns null for anything that is not an HttpErrorResponse', () => {
    expect(readApiError(new Error('boom'))).toBeNull();
  });

  it('tolerates a body without code', () => {
    const err = new HttpErrorResponse({ status: 500, error: 'Internal Server Error' });
    expect(readApiError(err)).toEqual({ status: 500, code: null, fieldErrors: {} });
  });

  it('maps MEMBER_GROUP_REQUIRED to the 순 field', () => {
    expect(mapApiError(groupRequired)).toEqual({
      code: 'MEMBER_GROUP_REQUIRED',
      messageKey: 'members.edit.errors.groupRequired',
      field: 'groupPublicId',
    });
  });

  it('returns null for an unknown code, so the caller falls back', () => {
    const err = new HttpErrorResponse({ status: 400, error: { code: 'SOMETHING_ELSE', message: '순 배정은 필수입니다.' } });
    expect(mapApiError(err)).toBeNull();
  });
});
