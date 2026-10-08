import { After, QuickPickleWorld, setWorldConstructor } from 'quickpickle';
import { vi } from 'vitest';
import { makeChargePayment } from '../application/ChargePayment';
import { makeRefundPayment } from '../application/RefundPayment';
import { PaymentsError } from '../domain/errors';
import { MemoryPaymentGateway } from '../infrastructure/MemoryPaymentGateway';
import { MemoryPayments } from '../infrastructure/MemoryPayments';

export class PaymentsWorld extends QuickPickleWorld {
  readonly payments = new MemoryPayments();
  readonly gateway = new MemoryPaymentGateway();
  readonly charge = vi.spyOn(this.gateway, 'charge');
  readonly chargePayment = makeChargePayment(this.payments, this.gateway);
  readonly refundPayment = makeRefundPayment(this.payments);

  /** Refusals no step has claimed yet; the After hook fails the scenario if any is left. */
  readonly refusals: PaymentsError[] = [];

  /** Runs a command; a business refusal is kept for "it is refused with", anything else fails the step. */
  async attempt<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof PaymentsError)) throw error;
      this.refusals.push(error);
      return undefined;
    }
  }
}

setWorldConstructor(PaymentsWorld);

After((world: PaymentsWorld) =>
  world.refusals.length === 0
    ? Promise.resolve()
    : Promise.reject(
        new Error(
          `unclaimed refusals: ${world.refusals.map((r) => r.code).join(', ')}`,
        ),
      ),
);
