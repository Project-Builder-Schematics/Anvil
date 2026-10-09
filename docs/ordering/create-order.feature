Feature: Create order

  Rule: Rule 1 - An order starts as Draft with no lines

    Scenario: a new order is a draft without lines
      When an order is created
      Then the order is "Draft"
      And the order has no lines

    Scenario: every order gets its own id
      When an order is created
      And an order is created
      Then the two orders have different ids
