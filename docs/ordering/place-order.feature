Feature: Place order

  Background:
    Given the catalog prices "keyboard" at 4500 "USD"
    And a draft order

  Rule: Rule 6 - Placing requires at least one line

    Scenario: an order with a line is placed and keeps its lines
      Given 1 of "keyboard" is added to the order
      When the order is placed
      Then the order is "Placed"
      And the order lines are
        | product  | quantity | unit price |
        | keyboard | 1        | 4500 USD   |

    Scenario: an order without lines is refused
      When the order is placed
      Then it is refused with "ORDER_EMPTY"
      And the order is "Draft"

  Rule: Rule 9 - A command that names an order that does not exist is refused

    @draft
    Scenario: an order that does not exist is refused
      Given an order id that names no order
      When the order is placed
      Then it is refused with "ORDER_NOT_FOUND"

  Rule: Rule 10 - Only a Draft order may be placed

    @draft
    Scenario: a placed order cannot be placed again
      Given 1 of "keyboard" is added to the order
      And the order has been placed
      When the order is placed
      Then it is refused with "ORDER_NOT_EDITABLE"
      And the order is "Placed"

    @draft
    Scenario: a cancelled order cannot be placed
      Given 1 of "keyboard" is added to the order
      And the order has been cancelled
      When the order is placed
      Then it is refused with "ORDER_NOT_EDITABLE"
      And the order is "Cancelled"

  Rule: Rule 11 - When several refusals hold, the first of the list wins

    @draft
    Scenario: the order state is checked before the lines
      Given the order has been cancelled
      When the order is placed
      Then it is refused with "ORDER_NOT_EDITABLE"
