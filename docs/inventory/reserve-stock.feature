Feature: Reserve stock

  Background:
    Given the stock level of "keyboard" is set to 10
    And the stock level of "mouse" is set to 5

  Rule: Rule 1 - A reservation is all-or-nothing

    Scenario: every line is reserved when the stock covers it
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
        | mouse    | 2        |
      Then the stock of "keyboard" is 10 on hand and 4 reserved
      And the stock of "mouse" is 5 on hand and 2 reserved

    Scenario: a line that takes exactly what is available is accepted
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 10       |
      Then the stock of "keyboard" is 10 on hand and 10 reserved

    Scenario: a line above what is available refuses the whole reservation
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
        | mouse    | 6        |
      Then it is refused with "INSUFFICIENT_STOCK"
      And the stock of "keyboard" is 10 on hand and 0 reserved
      And the stock of "mouse" is 5 on hand and 0 reserved

    Scenario: stock reserved for other orders is not available
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 8        |
      When the lines of order "o2" are reserved
        | product  | quantity |
        | keyboard | 3        |
      Then it is refused with "INSUFFICIENT_STOCK"
      And the stock of "keyboard" is 10 on hand and 8 reserved

  Rule: Rule 2 - There is one reservation per order

    Scenario: reserving again for the same order returns the existing reservation
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 6        |
      Then the reservation lists
        | product  | quantity |
        | keyboard | 4        |
      And the stock of "keyboard" is 10 on hand and 4 reserved

    Scenario: reserving again after the commit reserves nothing more
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
      And the reservation of order "o1" is committed
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
      Then the stock of "keyboard" is 6 on hand and 0 reserved

  Rule: Rule 5 - A product with no stock record is refused

    Scenario: an unstocked product refuses the whole reservation
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 1        |
        | ghost    | 1        |
      Then it is refused with "PRODUCT_NOT_STOCKED"
      And the stock of "keyboard" is 10 on hand and 0 reserved

  Rule: Rule 8 - A released reservation no longer counts as the order's reservation

    Scenario: reserving again after the release reserves again
      Given the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 4        |
      And the reservation of order "o1" is released
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 3        |
      Then the reservation lists
        | product  | quantity |
        | keyboard | 3        |
      And the stock of "keyboard" is 10 on hand and 3 reserved

  Rule: Rule 10 - PRODUCT_NOT_STOCKED wins over INSUFFICIENT_STOCK

    Scenario: an unstocked product is reported before a shortage
      When the lines of order "o1" are reserved
        | product  | quantity |
        | keyboard | 99       |
        | ghost    | 1        |
      Then it is refused with "PRODUCT_NOT_STOCKED"
