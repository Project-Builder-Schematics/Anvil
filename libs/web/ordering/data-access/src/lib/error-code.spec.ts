import { HttpErrorResponse } from '@angular/common/http';
import { errorCodeOf } from './error-code';

const failure = (status: number, error: unknown) =>
  new HttpErrorResponse({ status, error });

describe('errorCodeOf', () => {
  it('reads the code of a refusal body', () => {
    expect(
      errorCodeOf(failure(404, { statusCode: 404, code: 'ORDER_NOT_FOUND' })),
    ).toBe('ORDER_NOT_FOUND');
  });

  it('calls a failure without a response a network error', () => {
    expect(errorCodeOf(failure(0, new ProgressEvent('error')))).toBe(
      'NETWORK_ERROR',
    );
  });

  it('calls a server failure without a code a server error', () => {
    expect(
      errorCodeOf(failure(500, { message: 'Internal server error' })),
    ).toBe('SERVER_ERROR');
    expect(errorCodeOf(failure(502, 'Bad Gateway'))).toBe('SERVER_ERROR');
    expect(errorCodeOf(failure(500, null))).toBe('SERVER_ERROR');
  });

  it('keeps the code of a coded server failure', () => {
    expect(
      errorCodeOf(failure(500, { statusCode: 500, code: 'SOMETHING_NEW' })),
    ).toBe('SOMETHING_NEW');
  });

  it('calls everything else unknown: a body without a code, a body that is not an object, any other error', () => {
    expect(errorCodeOf(failure(400, { message: ['bad body'] }))).toBe(
      'UNKNOWN',
    );
    expect(errorCodeOf(failure(404, 'Not Found'))).toBe('UNKNOWN');
    expect(errorCodeOf(new Error('boom'))).toBe('UNKNOWN');
    expect(errorCodeOf(undefined)).toBe('UNKNOWN');
  });
});
