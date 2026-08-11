Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  # No @generate_sequence here on purpose: the tag lives on the equivalent test
  # in owner-search.spec.ts, so the sequence diagram is captured from the
  # plain-TypeScript side while this scenario still runs as an alternative.
  Scenario: Filter owners by a last name part
    Given at least one owner exists
    When I open the owners page
    And I search for owners by a last name part
    Then only owners whose last name starts with that part are listed
