Feature: Visit date range validation
  As a clinic user
  I want the visit date restricted to a sensible range
  So that I cannot record a visit before the pet was born or far in the future

  Scenario: Reject a visit dated before the pet's birth date
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in the visit date "0009-07-20" and a unique description
    Then the visit date is reported as out of range
    And the visit form cannot be submitted

  Scenario: Reject a visit dated more than one year in the future
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in a visit date 2 years in the future and a unique description
    Then the visit date is reported as out of range
    And the visit form cannot be submitted

  Scenario: Accept a visit dated within the allowed range
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in a visit date 1 months in the future and a unique description
    And I submit the visit form
    Then I am back on the owner's detail page
    And the pet's visit list contains the new visit

  Scenario: The API rejects a visit dated before the pet's birth date
    Given an owner with at least one pet exists
    When I post a visit dated "0009-07-20" to the API
    Then the API rejects it with status 400

  Scenario: The API rejects a visit dated more than one year in the future
    Given an owner with at least one pet exists
    When I post a visit dated 2 years in the future to the API
    Then the API rejects it with status 400
