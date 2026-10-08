Feature: Get stock level

  Background:
    Given the stock level of "keyboard" is set to 10

  Rule: Rule 4 - The counts shown follow the reservations

    Scenario: the stock shown has its reserved count
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
      When the stock of "keyboard" is requested
      Then the stock shown is 10 on hand and 4 reserved

  Rule: Rule 5 - A product with no stock record is refused

    Scenario: an unstocked product is refused
      When the stock of "ghost" is requested
      Then it is refused with "PRODUCT_NOT_STOCKED"
