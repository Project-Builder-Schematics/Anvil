# Payments glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.

**Payment.** The money taken for one order: its amount, its currency and its status. The aggregate root of the context. There is one per order.

**Order id.** The identity of the order a payment is for, as ordering names it. Payments only holds the id, and uses it as the idempotency key.

**Amount.** What is charged, as a whole number of the currency's minor units, greater than 0.

**Payment method token.** An opaque text that stands for a customer's means of payment. Payments never sees or keeps card data.

**Charge.** Ask the gateway to take the amount. A charge ends in `Captured`, or in `Failed` when the gateway declines.

**Pending.** The status of a payment while the gateway has not answered. It is never stored.

**Captured.** The status of a payment whose charge the gateway accepted. Only a captured payment can be refunded.

**Failed.** The status of a payment whose charge the gateway declined. The next charge of the same order replaces it.

**Refund.** Give back a captured payment.

**Refunded.** The final status of a payment that was refunded.

**Idempotency key.** The order id: charging the same order twice returns the first successful charge instead of taking the money twice.

**Payment gateway.** The driven port that takes the money. The real one is a third party; payments sees only its two outcomes, captured and declined.

**Anti-corruption layer (ACL).** The adapter that translates the gateway's own result into those two outcomes, so no gateway type reaches the domain.

**Payments.** The driven port that stores payments.

**Payments error.** The refusal a rule raises. It carries one error code, for example `PAYMENT_DECLINED`.
