Feature: Place order

  Background:
    Given the catalog prices "keyboard" at 4500 "USD"
    And the catalog prices "mouse" at 2500 "USD"
    And the stock of "keyboard" is 5
    And a draft order

  Rule: Rule 6 - Placing requires at least one line

    Scenario: an order with a line is paid and keeps its lines
      Given 1 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then the order is "Paid"
      And the order lines are
        | product  | quantity | unit price |
        | keyboard | 1        | 4500 USD   |

    Scenario: an order without lines is refused
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "ORDER_EMPTY"
      And the order is "Draft"
      And the number of charges requested is 0

  Rule: Rule 9 - A command that names an order that does not exist is refused

    Scenario: an order that does not exist is refused
      Given an order id that names no order
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "ORDER_NOT_FOUND"

  Rule: Rule 10 - Only a Draft order may be placed

    Scenario: a paid order cannot be placed again
      Given 1 of "keyboard" is added to the order
      And the order has been paid with the payment method "tok_visa"
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "ORDER_NOT_EDITABLE"
      And the order is "Paid"
      And the number of charges payments has captured is 1

    Scenario: a cancelled order cannot be placed
      Given 1 of "keyboard" is added to the order
      And the order has been cancelled
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "ORDER_NOT_EDITABLE"
      And the order is "Cancelled"

  Rule: Rule 11 - When several refusals hold, the first of the list wins

    Scenario: the order state is checked before the lines
      Given the order has been cancelled
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "ORDER_NOT_EDITABLE"

    Scenario: the lines are checked before the stock
      Given the stock of "keyboard" is 0
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "ORDER_EMPTY"

    Scenario: the stock is checked before the payment
      Given 1 of "keyboard" is added to the order
      And the stock of "keyboard" is 0
      When the order is placed with the payment method "tok_decline"
      Then it is refused with "INSUFFICIENT_STOCK"

  Rule: Rule 12 - Placing reserves the stock, charges the total, commits the stock and pays the order

    Scenario: the stock is committed and the total is charged with the token
      Given 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then the order is "Paid"
      And payments was asked to charge 9000 "USD" with the payment method "tok_visa"
      And the stock of "keyboard" is 3 on hand and 0 reserved

    Scenario: the lines of several products add up to the total
      Given 2 of "keyboard" is added to the order
      And 1 of "mouse" is added to the order
      And the stock of "mouse" is 5
      When the order is placed with the payment method "tok_visa"
      Then payments was asked to charge 11500 "USD" with the payment method "tok_visa"

    Scenario: a product added twice is reserved as one line
      Given 1 of "keyboard" is added to the order
      And 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then inventory was asked to reserve
        | product  | quantity |
        | keyboard | 3        |

  Rule: Rule 13 - When the stock cannot cover the order, the order goes back to Draft

    Scenario: no stock leaves nothing reserved and nothing charged
      Given the stock of "keyboard" is 1
      And 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "INSUFFICIENT_STOCK"
      And the order is "Draft"
      And the stock of "keyboard" is 1 on hand and 0 reserved
      And the number of charges requested is 0
      And no event is published

    Scenario: the customer places the order again once the stock is back
      Given the stock of "keyboard" is 1
      And 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "INSUFFICIENT_STOCK"
      Given the stock of "keyboard" is 5
      When the order is placed with the payment method "tok_visa"
      Then the order is "Paid"

    Scenario: a line the stock cannot cover reserves none of the others
      Given the stock of "mouse" is 0
      And 1 of "keyboard" is added to the order
      And 1 of "mouse" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "INSUFFICIENT_STOCK"
      And the stock of "keyboard" is 5 on hand and 0 reserved

  Rule: Rule 14 - When the payment is declined, the stock is released and the order goes back to Draft

    Scenario: a declined payment releases the stock
      Given 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_decline"
      Then it is refused with "PAYMENT_DECLINED"
      And the order is "Draft"
      And the stock of "keyboard" is 5 on hand and 0 reserved
      And the number of charges payments has captured is 0
      And no event is published

    Scenario: the customer places the order again with another payment method
      Given 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_decline"
      Then it is refused with "PAYMENT_DECLINED"
      When the order is placed with the payment method "tok_visa"
      Then the order is "Paid"
      And the stock of "keyboard" is 3 on hand and 0 reserved
      And the number of charges payments has captured is 1

  Rule: Rule 15 - Ordering publishes OrderPaid and OrderCancelled

    Scenario: a paid order publishes OrderPaid once
      Given 1 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then the events published are
        | event     |
        | OrderPaid |

  Rule: Rule 16 - PlaceOrder takes an opaque payment method token

    Scenario: the token reaches payments untouched
      Given 1 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_any-opaque_value"
      Then payments was asked to charge 4500 "USD" with the payment method "tok_any-opaque_value"

  Rule: Rule 17 - An unknown charge outcome is not compensated and placing a Placed order retries it

    Scenario: no answer from payments leaves the order placed with its stock reserved
      Given payments gives no answer to the next charge
      And 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then payments gave no answer
      And the order is "Placed"
      And the stock of "keyboard" is 5 on hand and 2 reserved
      And no event is published

    Scenario: placing a placed order again pays it with one charge
      Given 2 of "keyboard" is added to the order
      And the order has been placed while payments gives no answer
      When the order is placed with the payment method "tok_visa"
      Then the order is "Paid"
      And the number of charges payments has captured is 1
      And the stock of "keyboard" is 3 on hand and 0 reserved
      And the events published are
        | event     |
        | OrderPaid |

  Rule: Rule 18 - A product the stock does not hold is treated as a stock that cannot cover it

    Scenario: an unstocked product sends the order back to Draft
      Given 1 of "mouse" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "INSUFFICIENT_STOCK"
      And the order is "Draft"

  Rule: Rule 20 - Nothing is compensated once the charge is captured

    Scenario: a stock commit with no answer leaves the order placed with the money taken
      Given inventory gives no answer to the next commit
      And 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then inventory gave no answer
      And the order is "Placed"
      And the number of charges payments has captured is 1
      And the stock of "keyboard" is 5 on hand and 2 reserved
      And no event is published

    Scenario: placing the order again after the failed commit pays it with one charge
      Given inventory gives no answer to the next commit
      And 2 of "keyboard" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then inventory gave no answer
      When the order is placed with the payment method "tok_visa"
      Then the order is "Paid"
      And the number of charges payments has captured is 1
      And the stock of "keyboard" is 3 on hand and 0 reserved
      And the events published are
        | event     |
        | OrderPaid |

  Rule: Rule 21 - A refusal that leaves nothing charged is treated as a decline

    Scenario: an order with a total of 0 is refused as declined and goes back to Draft
      Given the catalog prices "sticker" at 0 "USD"
      And the stock of "sticker" is 5
      And 1 of "sticker" is added to the order
      When the order is placed with the payment method "tok_visa"
      Then it is refused with "PAYMENT_DECLINED"
      And the order is "Draft"
      And the stock of "sticker" is 5 on hand and 0 reserved
      And no event is published
