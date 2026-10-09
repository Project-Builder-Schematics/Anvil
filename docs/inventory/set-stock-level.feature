Feature: Set stock level

  Background:
    Given the stock level of "keyboard" is set to 10

  Rule: Rule 6 - The stock level is an integer of 0 or more

    Scenario: a level is stored
      When the stock level of "keyboard" is set to 25
      Then the stock of "keyboard" is 25 on hand and 0 reserved

    Scenario: zero is accepted
      When the stock level of "keyboard" is set to 0
      Then the stock of "keyboard" is 0 on hand and 0 reserved

    Scenario: a negative level is refused and the level stays
      When the stock level of "keyboard" is set to -1
      Then it is refused with "STOCK_LEVEL_INVALID"
      And the stock of "keyboard" is 10 on hand and 0 reserved

    Scenario: setting the level leaves the reserved count as it is
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
      When the stock level of "keyboard" is set to 25
      Then the stock of "keyboard" is 25 on hand and 4 reserved

  Rule: Rule 7 - Setting the level of an unstocked product creates its record

    Scenario: a product with no record gets one
      When the stock level of "lamp" is set to 3
      Then the stock of "lamp" is 3 on hand and 0 reserved

  Rule: Rule 11 - A level below the reserved count is refused

    Scenario: the level may not fall below the reserved count
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 8        |
      When the stock level of "keyboard" is set to 5
      Then it is refused with "STOCK_LEVEL_INVALID"
      And the stock of "keyboard" is 10 on hand and 8 reserved

    Scenario: the level may equal the reserved count
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 8        |
      When the stock level of "keyboard" is set to 8
      Then the stock of "keyboard" is 8 on hand and 8 reserved
