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

@Injectable()
export class MemoryPaymentGateway implements PaymentGateway {
  /** The keys that took money; a decline is not remembered, so its key can be charged again. */
  readonly capturedKeys = new Set<string>();

  charge({
    paymentMethodToken,
    idempotencyKey,
  }: ChargeRequest): Promise<ChargeOutcome> {
    if (this.capturedKeys.has(idempotencyKey))
      return Promise.resolve('Captured');
    const result: GatewayResult = {
      status:
        paymentMethodToken === DECLINED_TOKEN ? 'card_declined' : 'succeeded',
    };
    const outcome = outcomeOf(result);
    if (outcome === 'Captured') this.capturedKeys.add(idempotencyKey);
    return Promise.resolve(outcome);
  }
}
