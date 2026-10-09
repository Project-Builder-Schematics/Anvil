const MESSAGES = {
  PRODUCT_NOT_STOCKED:
    'This product is not stocked yet. Set a level to start stocking it.',
  STOCK_LEVEL_INVALID:
    'The level must be a whole number of 0 or more, and not below the units already reserved.',
  NETWORK_ERROR:
    'We could not reach the server. Check your connection and try again.',
  SERVER_ERROR: 'The server failed to complete the request. Try again.',
  COMMAND_IN_PROGRESS:
    'Another action is still running. Try again in a moment.',
} as const;

const GENERIC = 'Something went wrong. Try again.';

export type StockErrorCode = keyof typeof MESSAGES;

export const STOCK_ERROR_CODES = Object.keys(
  MESSAGES,
) as readonly StockErrorCode[];

/** `NETWORK_ERROR`, `SERVER_ERROR` and `COMMAND_IN_PROGRESS` are the client's own codes; the others are the API's refusal codes. */
export const messageFor = (code: string | undefined): string =>
  code !== undefined && Object.hasOwn(MESSAGES, code)
    ? MESSAGES[code as StockErrorCode]
    : GENERIC;
