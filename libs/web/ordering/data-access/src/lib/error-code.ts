import { HttpErrorResponse } from '@angular/common/http';

/** The API's refusal code, `NETWORK_ERROR` when nothing answered, `SERVER_ERROR` for an uncoded 5xx, `UNKNOWN` otherwise. */
export const errorCodeOf = (error: unknown): string => {
  if (!(error instanceof HttpErrorResponse)) return 'UNKNOWN';
  if (error.status === 0) return 'NETWORK_ERROR';
  const body: unknown = error.error;
  if (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof body.code === 'string'
  )
    return body.code;
  return error.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN';
};
