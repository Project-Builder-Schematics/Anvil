import { HttpErrorResponse } from '@angular/common/http';
import { errorCodeOf } from './error-code';

const failure = (status: number, error: unknown) =>
  new HttpErrorResponse({ status, error });

describe('errorCodeOf', () => {
  it('reads the code of a refusal body', () => {
    expect(
      errorCodeOf(
        failure(404, { statusCode: 404, code: 'PRODUCT_NOT_STOCKED' }),
      ),
    ).toBe('PRODUCT_NOT_STOCKED');
  });

  it('calls a failure without a response a network error', () => {
    expect(errorCodeOf(failure(0, new ProgressEvent('error')))).toBe(
      'NETWORK_ERROR',
    );
  });

  it('calls a server failure without a code a server error', () => {
    expect(errorCodeOf(failure(500, { message: 'Internal error' }))).toBe(
      'SERVER_ERROR',
    );
    expect(errorCodeOf(failure(502, null))).toBe('SERVER_ERROR');
  });

  it('calls everything else unknown', () => {
    expect(errorCodeOf(failure(400, { message: ['bad body'] }))).toBe(
      'UNKNOWN',
    );
    expect(errorCodeOf(new Error('boom'))).toBe('UNKNOWN');
    expect(errorCodeOf(undefined)).toBe('UNKNOWN');
  });
});
