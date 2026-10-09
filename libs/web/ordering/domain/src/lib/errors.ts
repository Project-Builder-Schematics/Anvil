const MESSAGES = {
  QUANTITY_OUT_OF_RANGE:
    'The quantity must be a whole number from 1 to 99, counting what the order already holds.',
  ORDER_NOT_EDITABLE: 'This order can no longer be changed.',
  PRODUCT_NOT_FOUND: 'We could not find that product. Check the product id.',
  ORDER_EMPTY: 'Add at least one line before placing the order.',
  CURRENCY_MISMATCH: 'Every line of an order must use the same currency.',
  ORDER_NOT_CANCELLABLE: 'This order cannot be cancelled.',
  ORDER_NOT_FOUND: 'We could not find that order.',
  PAYMENT_DECLINED:
    'The payment was declined and nothing was charged. The order is a draft again; try another payment token.',
  INSUFFICIENT_STOCK:
    'There is not enough stock for this order. It is a draft again; change the quantities and place it again.',
  PAYMENT_OUTCOME_UNKNOWN:
    'We could not confirm the payment, so the payment result is unknown. The order is still placed, and placing the order again is safe.',
  SERVER_ERROR: 'The server failed to complete the request. Try again.',
  COMMAND_IN_PROGRESS:
    'Another action is still running. Try again in a moment.',
  NETWORK_ERROR:
    'We could not reach the server. Check your connection and try again.',
} as const;

const GENERIC = 'Something went wrong. Try again.';

export type OrderingErrorCode = keyof typeof MESSAGES;

export const ORDERING_ERROR_CODES = Object.keys(
  MESSAGES,
) as readonly OrderingErrorCode[];

/** `NETWORK_ERROR`, `SERVER_ERROR`, `COMMAND_IN_PROGRESS` and `PAYMENT_OUTCOME_UNKNOWN` are the client's own codes; the others are the API's refusal codes. */
export const messageFor = (code: string | undefined): string =>
  code !== undefined && Object.hasOwn(MESSAGES, code)
    ? MESSAGES[code as OrderingErrorCode]
    : GENERIC;
