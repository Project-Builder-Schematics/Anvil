Feature: Refund payment

  Background:
    Given order "o1" has been charged 4500 "USD" with token "tok_visa"

  Rule: Rule 4 - Only a Captured payment can be refunded

    Scenario: a captured payment is refunded
      When order "o1" is refunded
      Then the payment of order "o1" is "Refunded" for 4500 "USD"

    Scenario: a refunded payment cannot be refunded again
      Given order "o1" has been refunded
      When order "o1" is refunded
      Then it is refused with "PAYMENT_NOT_REFUNDABLE"
      And the payment of order "o1" is "Refunded" for 4500 "USD"

    Scenario: a failed payment cannot be refunded
      Given order "o2" has been declined with token "tok_decline"
      When order "o2" is refunded
      Then it is refused with "PAYMENT_NOT_REFUNDABLE"
      And the payment of order "o2" is "Failed" for 4500 "USD"

  Rule: Rule 8 - An order with no payment cannot be refunded

    Scenario: an order that was never charged is refused
      When order "ghost" is refunded
      Then it is refused with "PAYMENT_NOT_REFUNDABLE"
