export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isInteger(amount) || amount < 0)
      throw new RangeError('Money amount must be a non-negative integer');
    if (!/^[A-Z]{3}$/.test(currency))
      throw new RangeError('Money currency must be three uppercase letters');
    return new Money(amount, currency);
  }
}
