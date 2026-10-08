export interface ChargeRequest {
  readonly amount: number;
  readonly currency: string;
  readonly paymentMethodToken: string;
}

export type ChargeOutcome = 'Captured' | 'Declined';

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeOutcome>;
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway');
