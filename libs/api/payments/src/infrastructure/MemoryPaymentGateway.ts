import { Injectable } from '@nestjs/common';
import type {
  ChargeOutcome,
  ChargeRequest,
  PaymentGateway,
} from '../domain/driven-ports/PaymentGateway';

/** What the fake gateway answers in its own vocabulary; it never leaves this file. */
interface GatewayResult {
  readonly status: 'succeeded' | 'card_declined';
}

const DECLINED_TOKEN = 'tok_decline';

const outcomeOf = ({ status }: GatewayResult): ChargeOutcome =>
  status === 'succeeded' ? 'Captured' : 'Declined';

interface Remembered {
  readonly request: string;
  readonly outcome: ChargeOutcome;
}

/** A gateway failure with no outcome: the fake throws it for a key reused with other parameters, and scenarios use it for a call that gives no answer. The use case treats every gateway failure alike. */
export class GatewayError extends Error {}

@Injectable()
export class MemoryPaymentGateway implements PaymentGateway {
  /** The first outcome per idempotency key, a decline included; a call that throws leaves nothing. */
  readonly outcomes = new Map<string, Remembered>();

  get captured(): number {
    return [...this.outcomes.values()].filter((r) => r.outcome === 'Captured')
      .length;
  }

  charge({
    amount,
    currency,
    paymentMethodToken,
    idempotencyKey,
  }: ChargeRequest): Promise<ChargeOutcome> {
    const request = JSON.stringify([amount, currency, paymentMethodToken]);
    const first = this.outcomes.get(idempotencyKey);
    if (first)
      return first.request === request
        ? Promise.resolve(first.outcome)
        : Promise.reject(
            new GatewayError(
              'idempotency key reused with different parameters',
            ),
          );
    const result: GatewayResult = {
      status:
        paymentMethodToken === DECLINED_TOKEN ? 'card_declined' : 'succeeded',
    };
    const outcome = outcomeOf(result);
    this.outcomes.set(idempotencyKey, { request, outcome });
    return Promise.resolve(outcome);
  }
}
