Feature: Commit stock

  Background:
    Given the stock level of "keyboard" is set to 10
    And the stock level of "mouse" is set to 5
    And the lines of order "o1" are reserved
      | product  | quantity |
      | keyboard | 4        |
      | mouse    | 2        |

  Rule: Rule 4 - Committing a reservation decrements onHand and reserved

    Scenario: both counts of every line go down by its quantity
      When the reservation of order "o1" is committed
      Then the stock of "keyboard" is 6 on hand and 0 reserved
      And the stock of "mouse" is 3 on hand and 0 reserved

    Scenario: the reservations of other orders are untouched
      Given the lines of order "o2" are reserved
        | product  | quantity |
        | keyboard | 3        |
      When the reservation of order "o1" is committed
      Then the stock of "keyboard" is 6 on hand and 3 reserved

  Rule: Rule 9 - Only a held reservation can be committed

    Scenario: committing twice decrements once
      When the reservation of order "o1" is committed
      And the reservation of order "o1" is committed
      Then the stock of "keyboard" is 6 on hand and 0 reserved

    Scenario: committing an unknown reservation changes nothing
      When the reservation of order "ghost" is committed
      Then the stock of "keyboard" is 10 on hand and 4 reserved

    Scenario: committing a released reservation changes nothing
      Given the reservation of order "o1" is released
      When the reservation of order "o1" is committed
      Then the stock of "keyboard" is 10 on hand and 0 reserved
