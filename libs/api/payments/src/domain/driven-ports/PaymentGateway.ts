export interface ChargeRequest {
  readonly amount: number;
  readonly currency: string;
  readonly paymentMethodToken: string;
  /** A repeated key returns the first successful outcome and takes no more money. */
  readonly idempotencyKey: string;
}

export type ChargeOutcome = 'Captured' | 'Declined';

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeOutcome>;
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway');
