import { HttpErrorResponse } from '@angular/common/http';

/** The API's refusal code, `NETWORK_ERROR` when nothing answered, `UNKNOWN` otherwise. */
export const errorCodeOf = (error: unknown): string => {
  if (!(error instanceof HttpErrorResponse)) return 'UNKNOWN';
  if (error.status === 0) return 'NETWORK_ERROR';
  const body: unknown = error.error;
  return typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof body.code === 'string'
    ? body.code
    : 'UNKNOWN';
};
