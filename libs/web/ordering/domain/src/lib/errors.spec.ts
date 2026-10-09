import { messageFor, ORDERING_ERROR_CODES } from './errors';

describe('messageFor', () => {
  it('answers a distinct human message for every refusal code', () => {
    const messages = ORDERING_ERROR_CODES.map(messageFor);

    expect(new Set(messages).size).toBe(ORDERING_ERROR_CODES.length);
    for (const message of messages) expect(message).toMatch(/\.$/);
  });

  it('names the broken rule in the quantity message', () => {
    expect(messageFor('QUANTITY_OUT_OF_RANGE')).toContain('1 to 99');
  });

  it('tells the user to wait when another action is still running', () => {
    expect(messageFor('COMMAND_IN_PROGRESS')).toBe(
      'Another action is still running. Try again in a moment.',
    );
  });

  it('says a declined payment charged nothing and a new token can be tried', () => {
    expect(messageFor('PAYMENT_DECLINED')).toBe(
      'The payment was declined and nothing was charged. The order is a draft again; try another payment token.',
    );
  });

  it('says an order the stock cannot cover is a draft again', () => {
    expect(messageFor('INSUFFICIENT_STOCK')).toBe(
      'There is not enough stock for this order. It is a draft again; change the quantities and place it again.',
    );
  });

  it('says the payment result is unknown and that placing again is safe', () => {
    const message = messageFor('PAYMENT_OUTCOME_UNKNOWN');

    expect(message).toContain('payment result is unknown');
    expect(message).toContain('placing the order again is safe');
  });

  it('answers a message for a server error', () => {
    expect(messageFor('SERVER_ERROR')).toBe(
      'The server failed to complete the request. Try again.',
    );
  });

  it('answers a generic message for a code it does not know and for none', () => {
    const generic = 'Something went wrong. Try again.';

    expect(messageFor('SOMETHING_NEW')).toBe(generic);
    expect(messageFor(undefined)).toBe(generic);
    expect(messageFor('')).toBe(generic);
  });
});
