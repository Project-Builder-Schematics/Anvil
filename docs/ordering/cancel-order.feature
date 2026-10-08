Feature: Cancel order

  Background:
    Given the catalog prices "keyboard" at 4500 "USD"
    And the stock of "keyboard" is 5
    And a draft order

  Rule: Rule 8 - An order may be cancelled from Draft or Placed

    Scenario: a draft order is cancelled
      When the order is cancelled
      Then the order is "Cancelled"

    @draft
    Scenario: a placed order is cancelled
      Given 1 of "keyboard" is added to the order
      And the order has been placed while payments gives no answer
      When the order is cancelled
      Then the order is "Cancelled"

    Scenario: a paid order cannot be cancelled
      Given 1 of "keyboard" is added to the order
      And the order has been paid with the payment method "tok_visa"
      When the order is cancelled
      Then it is refused with "ORDER_NOT_CANCELLABLE"
      And the order is "Paid"

    Scenario: a cancelled order cannot be cancelled again
      Given the order has been cancelled
      When the order is cancelled
      Then it is refused with "ORDER_NOT_CANCELLABLE"
      And the order is "Cancelled"

  Rule: Rule 9 - A command that names an order that does not exist is refused

    Scenario: an order that does not exist is refused
      Given an order id that names no order
      When the order is cancelled
      Then it is refused with "ORDER_NOT_FOUND"

  Rule: Rule 15 - Ordering publishes OrderPaid and OrderCancelled

    Scenario: a cancelled order publishes OrderCancelled
      When the order is cancelled
      Then the events published are
        | event          |
        | OrderCancelled |

    Scenario: a refused cancel publishes nothing
      Given the order has been cancelled
      When the order is cancelled
      Then it is refused with "ORDER_NOT_CANCELLABLE"
      And the events published are
        | event          |
        | OrderCancelled |
