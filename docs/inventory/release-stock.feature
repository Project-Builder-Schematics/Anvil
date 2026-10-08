Feature: Release stock

  Background:
    Given the stock level of "keyboard" is set to 10
    And the lines of order "o1" are reserved
      | product  | quantity |
      | keyboard | 4        |

  Rule: Rule 3 - Releasing a reservation returns its quantities

    Scenario: the released quantities are available again
      When the reservation of order "o1" is released
      Then the stock of "keyboard" is 10 on hand and 0 reserved

    Scenario: releasing twice returns the quantities once
      Given the lines of order "o2" are reserved
        | product  | quantity |
        | keyboard | 2        |
      When the reservation of order "o1" is released
      And the reservation of order "o1" is released
      Then the stock of "keyboard" is 10 on hand and 2 reserved

    Scenario: releasing an unknown reservation changes nothing
      When the reservation of order "ghost" is released
      Then the stock of "keyboard" is 10 on hand and 4 reserved

  Rule: Rule 9 - Only a held reservation can be released

    @draft
    Scenario: a committed reservation cannot be released
      Given the reservation of order "o1" is committed
      When the reservation of order "o1" is released
      Then the stock of "keyboard" is 6 on hand and 0 reserved
