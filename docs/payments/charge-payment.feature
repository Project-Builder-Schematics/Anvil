Feature: Charge payment

  Rule: Rule 1 - The amount is greater than 0

    Scenario: a positive amount is captured
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the answer is "Captured" for 4500 "USD" on order "o1"

    Scenario: the smallest amount is accepted
      When order "o1" is charged 1 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 1 "USD"
      And the answer is "Captured" for 1 "USD" on order "o1"

    Scenario: zero is refused and nothing is stored
      When order "o1" is charged 0 "USD" with token "tok_visa"
      Then it is refused with "INVALID_AMOUNT"
      And order "o1" has no payment

    Scenario: a negative amount is refused
      When order "o1" is charged -5 "USD" with token "tok_visa"
      Then it is refused with "INVALID_AMOUNT"
      And order "o1" has no payment

  Rule: Rule 2 - There is one successful charge per order

    Scenario: charging again returns the existing charge
      Given order "o1" has been charged 4500 "USD" with token "tok_visa"
      When order "o1" is charged 9000 "USD" with token "tok_other"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the answer is "Captured" for 4500 "USD" on order "o1"
      And the gateway has been charged 1 in total

    Scenario: another order is charged on its own
      Given order "o1" has been charged 4500 "USD" with token "tok_visa"
      When order "o2" is charged 100 "USD" with token "tok_visa"
      Then the payment of order "o2" is "Captured" for 100 "USD"
      And the answer is "Captured" for 100 "USD" on order "o2"
      And the gateway has been charged 2 in total

  Rule: Rule 3 - A gateway decline leaves the payment Failed

    Scenario: a declined token fails the payment
      When order "o1" is charged 4500 "USD" with token "tok_decline"
      Then it is refused with "PAYMENT_DECLINED"
      And the payment of order "o1" is "Failed" for 4500 "USD"

  Rule: Rule 5 - A charge takes an opaque token and never card data

    Scenario: the gateway is given the token
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the gateway was asked to charge 4500 "USD" with token "tok_visa"

    Scenario: any token but the declined one is captured
      When order "o1" is charged 4500 "USD" with token "tok_anything"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the answer is "Captured" for 4500 "USD" on order "o1"

  Rule: Rule 6 - The amount is an integer

    Scenario: a fractional amount is refused
      When order "o1" is charged 10.5 "USD" with token "tok_visa"
      Then it is refused with "INVALID_AMOUNT"
      And order "o1" has no payment

  Rule: Rule 7 - A failed payment does not count as the order's charge

    Scenario: charging again after a decline charges again
      Given order "o1" has been declined at 4500 "USD" with token "tok_decline"
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the answer is "Captured" for 4500 "USD" on order "o1"

    Scenario: a refunded payment is still the order's charge
      Given order "o1" has been charged 4500 "USD" with token "tok_visa"
      And order "o1" has been refunded
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Refunded" for 4500 "USD"
      And the answer is "Refunded" for 4500 "USD" on order "o1"

  Rule: Rule 10 - INVALID_AMOUNT wins over an existing charge

    Scenario: an invalid amount is refused even when the order is already charged
      Given order "o1" has been charged 4500 "USD" with token "tok_visa"
      When order "o1" is charged 0 "USD" with token "tok_visa"
      Then it is refused with "INVALID_AMOUNT"
      And the payment of order "o1" is "Captured" for 4500 "USD"

  Rule: Rule 12 - A charge is stored Pending before the gateway is called

    Scenario: a gateway that gives no answer leaves the payment Pending
      Given the gateway gives no answer
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the charge fails with "gateway timeout"
      And the payment of order "o1" is "Pending" for 4500 "USD"

  Rule: Rule 13 - A Pending payment is resolved by charging the order again

    Scenario: charging again captures the pending payment
      Given the gateway gave no answer to the charge of order "o1" at 4500 "USD" with token "tok_visa"
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the gateway has been charged 1 in total

    Scenario: charging again when the answer was lost takes the money once
      Given the gateway took the money of order "o1" at 4500 "USD" with token "tok_visa" but its answer was lost
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the gateway has been charged 1 in total
      And the number of idempotency keys the gateway was given is 1

    Scenario: charging again with another token resolves with the first request
      Given the gateway took the money of order "o1" at 4500 "USD" with token "tok_visa" but its answer was lost
      When order "o1" is charged 9000 "USD" with token "tok_decline"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the answer is "Captured" for 4500 "USD" on order "o1"
      And the gateway was last asked to charge 4500 "USD" with token "tok_visa"
      And the gateway has been charged 1 in total
      And the number of idempotency keys the gateway was given is 1

    Scenario: a pending payment declined with its stored token fails and the next charge starts a new one
      Given the gateway gave no answer to the charge of order "o1" at 4500 "USD" with token "tok_decline"
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then it is refused with "PAYMENT_DECLINED"
      And the payment of order "o1" is "Failed" for 4500 "USD"
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the gateway was last asked to charge 4500 "USD" with token "tok_visa"
      And the number of idempotency keys the gateway was given is 2

  Rule: Rule 14 - The idempotency key is the id of the payment

    Scenario: the gateway is given the id of the payment as its key
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the gateway was given the id of the payment of order "o1" as its idempotency key

    Scenario: two charges started together take the money once
      When order "o1" is charged 4500 "USD" with token "tok_visa" twice at once
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the answer is "Captured" for 4500 "USD" on order "o1"
      And the gateway has been charged 1 in total
      And the number of idempotency keys the gateway was given is 1

    Scenario: charging again after a decline uses a new key and captures
      Given order "o1" has been declined at 4500 "USD" with token "tok_decline"
      When order "o1" is charged 4500 "USD" with token "tok_visa"
      Then the payment of order "o1" is "Captured" for 4500 "USD"
      And the number of idempotency keys the gateway was given is 2
