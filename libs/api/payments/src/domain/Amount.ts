import { PaymentsError } from './errors';

export class Amount {
  private constructor(readonly value: number) {}

  static of(value: number): Amount {
    if (!Number.isInteger(value) || value <= 0)
      throw new PaymentsError('INVALID_AMOUNT');
    return new Amount(value);
  }
}
