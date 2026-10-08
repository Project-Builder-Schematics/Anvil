# Payments glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.

**Payment.** The money taken for one order: its id, its amount, its currency, its token and its status. The aggregate root of the context. An order has one payment at a time; a failed payment is replaced by a new one.

**Order id.** The identity of the order a payment is for, as ordering names it. Payments only holds the id, to find the order's payment.

**Amount.** What is charged, as a whole number of the currency's minor units, greater than 0.

**Payment method token.** An opaque text that stands for a customer's means of payment. Payments never sees card data; a payment keeps the token of its request so a `Pending` retry can resolve it.

**Charge.** Ask the gateway to take the amount. A charge ends in `Captured`, or in `Failed` when the gateway declines, or stays `Pending` when the gateway gives no answer.

**Pending.** The status of a payment stored before the gateway is called. It stays while the outcome is unknown, and the next charge of the order resolves that same payment with its stored request.

**Captured.** The status of a payment whose charge the gateway accepted. Only a captured payment can be refunded.

**Failed.** The status of a payment whose charge the gateway declined. The next charge of the same order replaces it.

**Refund.** Give back a captured payment.

**Refunded.** The final status of a payment that was refunded.

**Idempotency key.** The id of a payment, sent to the gateway with its charge. The gateway saves the outcome of the first request made with a key, captured or declined, and replays it instead of taking the money twice; it refuses the same key with other parameters. A new payment has a new key.

**Payment gateway.** The driven port that takes the money. The real one is a third party; payments sees only its two outcomes, captured and declined.

**Anti-corruption layer (ACL).** The adapter that translates the gateway's own result into those two outcomes, so no gateway type reaches the domain.

**Payments.** The driven port that stores payments.

**Payments error.** The refusal a rule raises. It carries one error code, for example `PAYMENT_DECLINED`.
