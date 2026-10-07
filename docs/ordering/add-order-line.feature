Feature: Add order line

  Background:
    Given the catalog prices "keyboard" at 4500 "USD"
    And the catalog prices "mouse" at 2500 "USD"
    And the catalog prices "cable" at 900 "EUR"
    And a draft order

  Rule: Rule 2 - Quantity is an integer from 1 to 99 inclusive

    Scenario: the lowest quantity is accepted
      When 1 of "keyboard" is added to the order
      Then the order lines are
        | product  | quantity | unit price |
        | keyboard | 1        | 4500 USD   |

    Scenario: the highest quantity is accepted
      When 99 of "keyboard" is added to the order
      Then the order lines are
        | product  | quantity | unit price |
        | keyboard | 99       | 4500 USD   |

    Scenario: zero is refused
      When 0 of "keyboard" is added to the order
      Then it is refused with "QUANTITY_OUT_OF_RANGE"
      And the order has no lines

    Scenario: above the highest quantity is refused
      When 100 of "keyboard" is added to the order
      Then it is refused with "QUANTITY_OUT_OF_RANGE"
      And the order has no lines

  Rule: Rule 3 - Adding a product already in the order adds to that line

    Scenario: the same product again adds to its line
      When 2 of "keyboard" is added to the order
      And 3 of "keyboard" is added to the order
      Then the order lines are
        | product  | quantity | unit price |
        | keyboard | 5        | 4500 USD   |

    Scenario: a sum of exactly 99 is accepted
      When 60 of "keyboard" is added to the order
      And 39 of "keyboard" is added to the order
      Then the order lines are
        | product  | quantity | unit price |
        | keyboard | 99       | 4500 USD   |

    Scenario: a sum above 99 is refused and the line keeps its quantity
      When 60 of "keyboard" is added to the order
      And 40 of "keyboard" is added to the order
      Then it is refused with "QUANTITY_OUT_OF_RANGE"
      And the order lines are
        | product  | quantity | unit price |
        | keyboard | 60       | 4500 USD   |

    Scenario: another product makes another line
      When 1 of "keyboard" is added to the order
      And 2 of "mouse" is added to the order
      Then the order lines are
        | product  | quantity | unit price |
        | keyboard | 1        | 4500 USD   |
        | mouse    | 2        | 2500 USD   |

  Rule: Rule 4 - Only a Draft order may change its lines

    Scenario: a placed order refuses new lines
      Given 1 of "keyboard" is added to the order
      And the order has been placed
      When 1 of "mouse" is added to the order
      Then it is refused with "ORDER_NOT_EDITABLE"
      And the order lines are
        | product  | quantity | unit price |
        | keyboard | 1        | 4500 USD   |

    Scenario: a cancelled order refuses new lines
      Given the order has been cancelled
      When 1 of "keyboard" is added to the order
      Then it is refused with "ORDER_NOT_EDITABLE"
      And the order has no lines

  Rule: Rule 5 - The unit price is frozen when the line is added

    Scenario: a later price change does not touch the line
      Given 1 of "keyboard" is added to the order
      And the catalog prices "keyboard" at 5000 "USD"
      When 1 of "keyboard" is added to the order
      Then the order lines are
        | product  | quantity | unit price |
        | keyboard | 2        | 4500 USD   |

    Scenario: an unknown product is refused
      When 1 of "ghost" is added to the order
      Then it is refused with "PRODUCT_NOT_FOUND"
      And the order has no lines

  Rule: Rule 7 - Every line of an order uses the same currency

    Scenario: a line in another currency is refused
      Given 1 of "keyboard" is added to the order
      When 1 of "cable" is added to the order
      Then it is refused with "CURRENCY_MISMATCH"
      And the order lines are
        | product  | quantity | unit price |
        | keyboard | 1        | 4500 USD   |

  Rule: Rule 9 - A command that names an order that does not exist is refused

    @draft
    Scenario: an order that does not exist is refused
      Given an order id that names no order
      When 1 of "keyboard" is added to the order
      Then it is refused with "ORDER_NOT_FOUND"

  Rule: Rule 11 - When several refusals hold, the first of the list wins

    @draft
    Scenario: the order is looked up before the quantity is checked
      Given an order id that names no order
      When 0 of "keyboard" is added to the order
      Then it is refused with "ORDER_NOT_FOUND"

    @draft
    Scenario: the quantity is checked before the product
      When 0 of "ghost" is added to the order
      Then it is refused with "QUANTITY_OUT_OF_RANGE"

    @draft
    Scenario: the product is checked before the order state
      Given 1 of "keyboard" is added to the order
      And the order has been placed
      When 1 of "ghost" is added to the order
      Then it is refused with "PRODUCT_NOT_FOUND"

    @draft
    Scenario: the order state is checked before the sum
      Given 1 of "keyboard" is added to the order
      And the order has been placed
      When 99 of "keyboard" is added to the order
      Then it is refused with "ORDER_NOT_EDITABLE"
