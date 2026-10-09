import { messageFor, STOCK_ERROR_CODES } from './errors';

describe('messageFor', () => {
  it('answers a distinct human message for every code', () => {
    const messages = STOCK_ERROR_CODES.map(messageFor);

    expect(new Set(messages).size).toBe(STOCK_ERROR_CODES.length);
    for (const message of messages) expect(message).toMatch(/\.$/);
  });

  it('says a product with no record is not stocked yet and that setting a level starts it (rule 7)', () => {
    expect(messageFor('PRODUCT_NOT_STOCKED')).toBe(
      'This product is not stocked yet. Set a level to start stocking it.',
    );
  });

  it('names the broken rules in the invalid level message (rules I6 and 11)', () => {
    const message = messageFor('STOCK_LEVEL_INVALID');

    expect(message).toContain('whole number');
    expect(message).toContain('reserved');
  });

  it('answers a generic message for a code it does not know and for none', () => {
    const generic = 'Something went wrong. Try again.';

    expect(messageFor('SOMETHING_NEW')).toBe(generic);
    expect(messageFor(undefined)).toBe(generic);
  });
});
