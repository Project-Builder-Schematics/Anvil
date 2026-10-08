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

  it('answers a generic message for a code it does not know and for none', () => {
    const generic = 'Something went wrong. Try again.';

    expect(messageFor('SOMETHING_NEW')).toBe(generic);
    expect(messageFor(undefined)).toBe(generic);
    expect(messageFor('')).toBe(generic);
  });
});
