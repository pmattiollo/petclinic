Feature: Owner search
  As a clinic user
  I want to search owners by any visible field
  So that I can quickly find the owner I'm looking for

  Background:
    Given an owner "Maria Silva" with address "Main St" exists with a pet named "Buddy"
    And an owner "John Davis" with address "Oak Ave" exists with a pet named "Whiskers"

  Scenario Outline: Search finds the right owner
    When I search for "<term>"
    Then the owner "<expected owner>" is shown in results

    Examples:
      | term      | expected owner | note                        |
      | Silva     | Maria Silva    | last name exact             |
      | davis     | John Davis     | last name case-insensitive  |
      | Main      | Maria Silva    | street partial              |
      | Bud       | Maria Silva    | pet name partial            |
      | Whisk     | John Davis     | pet name partial            |

  Scenario: Empty search returns all owners
    When I clear the search
    Then all owners are shown

  Scenario: No results shows informative message
    When I search for "xyzxyzxyz"
    Then no owners are shown
    And the message contains "xyzxyzxyz"
