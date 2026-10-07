Feature: Cancel order

  Background:
    Given the catalog prices "keyboard" at 4500 "USD"
    And a draft order

  # This slice has no Paid state, so rule 8 refuses only an order that is already Cancelled.
  Rule: Rule 8 - An order may be cancelled from Draft or Placed

    Scenario: a draft order is cancelled
      When the order is cancelled
      Then the order is "Cancelled"

    Scenario: a placed order is cancelled
      Given 1 of "keyboard" is added to the order
      And the order has been placed
      When the order is cancelled
      Then the order is "Cancelled"

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
