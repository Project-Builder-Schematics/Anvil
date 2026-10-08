import { After, QuickPickleWorld, setWorldConstructor } from 'quickpickle';
import { vi } from 'vitest';
import { makeChargePayment } from '../application/ChargePayment';
import { makeRefundPayment } from '../application/RefundPayment';
import type { PaymentView } from '../application/PaymentView';
import { MemoryPaymentGateway } from '../infrastructure/MemoryPaymentGateway';
import { MemoryPayments } from '../infrastructure/MemoryPayments';

export class PaymentsWorld extends QuickPickleWorld {
  readonly payments = new MemoryPayments();
  readonly gateway = new MemoryPaymentGateway();
  readonly charge = vi.spyOn(this.gateway, 'charge');
  readonly chargePayment = makeChargePayment(this.payments, this.gateway);
  readonly refundPayment = makeRefundPayment(this.payments);

  /** What the use case answered to the charge the scenario is about. */
  readonly answers: PaymentView[] = [];

  /** Refusals no step has claimed yet; the After hook fails the scenario if any is left. */
  readonly refusals: Error[] = [];

  /** What a gateway that gives no answer throws. */
  readonly timeout = new Error('gateway timeout');

  /** Runs a command; any error it throws is kept until a step claims it, or the After hook fails the scenario. */
  async attempt<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof Error) {
        this.refusals.push(error);
        return undefined;
      }
      throw error;
    }
  }
}

setWorldConstructor(PaymentsWorld);

After((world: PaymentsWorld) =>
  world.refusals.length === 0
    ? Promise.resolve()
    : Promise.reject(
        new Error(
          `unclaimed refusals: ${world.refusals.map((r) => r.message).join(', ')}`,
        ),
      ),
);
