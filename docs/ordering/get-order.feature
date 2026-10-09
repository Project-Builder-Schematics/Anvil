Feature: Get order

  Background:
    Given the catalog prices "keyboard" at 4500 "USD"
    And a draft order

  Rule: Rule 1 - An order starts as Draft with no lines

    Scenario: a new order is shown as a draft without lines
      When the order is requested
      Then the order shown is "Draft"
      And the order shown lists no lines

  Rule: Rule 5 - The unit price is frozen when the line is added

    Scenario: the order shows the price its line was added at
      Given 2 of "keyboard" is added to the order
      And the catalog prices "keyboard" at 5000 "USD"
      When the order is requested
      Then the order shown has the lines
        | product  | quantity | unit price |
        | keyboard | 2        | 4500 USD   |

  Rule: Rule 9 - A command that names an order that does not exist is refused

    Scenario: an order that does not exist is refused
      Given an order id that names no order
      When the order is requested
      Then it is refused with "ORDER_NOT_FOUND"
