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
  charge({ paymentMethodToken }: ChargeRequest): Promise<ChargeOutcome> {
    const result: GatewayResult = {
      status:
        paymentMethodToken === DECLINED_TOKEN ? 'card_declined' : 'succeeded',
    };
    return Promise.resolve(outcomeOf(result));
  }
}
