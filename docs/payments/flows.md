# Payments — flows

Sequence diagrams for [payments](domain-model.md). Rule numbers refer to its Business rules. One Mermaid `sequenceDiagram` per use case whose request crosses more than one component: controller, use case, driven ports, and whatever happens after the response.

## ChargePayment

Called by ordering through the barrel; no route.

```mermaid
sequenceDiagram
  participant O as Ordering
  participant U as ChargePayment
  participant P as Payments
  participant G as PaymentGateway
  O->>U: { orderId, amount, currency, paymentMethodToken }
  Note over U: Amount.of: rules 1, 6
  alt not an integer greater than 0
    U-->>O: INVALID_AMOUNT (rules 1, 6, 10)
  end
  U->>P: startCharge(payment Pending)
  alt a Captured or Refunded payment exists
    P-->>U: the existing payment
    U-->>O: the existing payment (rule 2)
  end
  Note over P: a Pending payment is kept and resolved with its stored request (rule 13); a Failed one is replaced by a new payment (rules 7, 14)
  U->>G: charge({ the payment's amount, currency and token, idempotencyKey: payment id })
  Note over G: the adapter translates the gateway's result (ACL); a repeated key replays the first outcome (rule 14)
  alt the gateway gives no answer
    G--)U: error
    U-->>O: the error; the payment stays Pending (rule 12)
  end
  G-->>U: Captured or Declined
  U->>P: save(payment Captured or Failed)
  alt declined
    U-->>O: PAYMENT_DECLINED (rule 3)
  end
  U-->>O: { orderId, status, amount, currency }
```

## RefundPayment

```mermaid
sequenceDiagram
  participant O as Ordering
  participant U as RefundPayment
  participant P as Payments
  O->>U: { orderId }
  U->>P: byOrderId(orderId)
  Note over U: Payment.refund: rule 4
  alt no payment, or not Captured
    U-->>O: PAYMENT_NOT_REFUNDABLE (rules 4, 8)
  end
  U->>P: save(payment Refunded)
  U-->>O: { orderId, status, amount, currency }
```
