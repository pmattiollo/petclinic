Feature: Owner management

  Scenario: Register a new owner
    When I register an owner with first name "Eduardo", last name "Rodriquez", address "2693 Commerce St.", city "McFarland", telephone "6085558763"
    Then the response status is 201
    And the owner is searchable by last name "Rodriquez"

  Scenario: Search owners by last name
    Given the following owners exist:
      | firstName | lastName  |
      | George    | Franklin  |
      | Betty     | Davis     |
      | Harold    | Davis     |
    When I GET "/api/owners?lastName=Dav"
    Then the response status is 200
    And the response JSON array has size 2
    And every item in the response has "lastName" equal to "Davis"

  Scenario: Owner profile includes pets with their type
    Given an owner "Jean Coleman" with a "dog" pet named "Samantha" born on "2020-03-15"
    When I fetch the owner "Jean Coleman"
    Then the response status is 200
    And the owner has 1 pet
    And the pet at index 0 has name "Samantha" and type "dog"

  Scenario: Cannot register an owner without a first name
    When I POST to "/api/owners" the JSON:
      """
      {"lastName":"Rodriquez","address":"2693 Commerce St.","city":"McFarland","telephone":"6085558763"}
      """
    Then the response status is 400

  Scenario: Owners are listed a page at a time, 10 by default
    Given 15 owners exist with distinct last names
    When I GET "/api/owners"
    Then the response status is 200
    And the response content array has size 10
    And the response has totalElements 15
    And the response has totalPages 2

  Scenario: An explicit page and size are honored
    Given 15 owners exist with distinct last names
    When I GET "/api/owners?page=1&size=5"
    Then the response status is 200
    And the response content array has size 5
    And the response has totalElements 15
    And the response has totalPages 3

  Scenario: Sorting by name ascending
    Given the following owners exist:
      | firstName | lastName |
      | Bob       | Zeta     |
      | Alice     | Alpha    |
    When I GET "/api/owners?sort=name,asc"
    Then the response status is 200
    And the content is sorted by "lastName" ascending

  Scenario: Sorting by name descending
    Given the following owners exist:
      | firstName | lastName |
      | Bob       | Zeta     |
      | Alice     | Alpha    |
    When I GET "/api/owners?sort=name,desc"
    Then the response status is 200
    And the content is sorted by "lastName" descending

  Scenario: Sorting by city ascending
    Given the following owners exist:
      | firstName | lastName | city   |
      | Bob       | Smith    | Zurich |
      | Alice     | Jones    | Athens |
    When I GET "/api/owners?sort=city,asc"
    Then the response status is 200
    And the content is sorted by "city" ascending

  Scenario: Sorting by city descending
    Given the following owners exist:
      | firstName | lastName | city   |
      | Bob       | Smith    | Zurich |
      | Alice     | Jones    | Athens |
    When I GET "/api/owners?sort=city,desc"
    Then the response status is 200
    And the content is sorted by "city" descending

  Scenario: An invalid sort value is rejected
    When I GET "/api/owners?sort=bogus,asc"
    Then the response status is 400
    And the response body contains "name,asc"

  Scenario: A zero page size is rejected
    When I GET "/api/owners?size=0"
    Then the response status is 400
    And the response body contains "positive"

  Scenario: A negative page number is rejected
    When I GET "/api/owners?page=-1"
    Then the response status is 400

  Scenario: A page beyond the last page is not an error
    Given 3 owners exist with distinct last names
    When I GET "/api/owners?page=5&size=10"
    Then the response status is 200
    And the response content array has size 0
    And the response has totalElements 3
    And the response has totalPages 1

  Scenario: Paging through owners with duplicate names does not lose or repeat rows
    Given the following owners exist:
      | firstName | lastName |
      | Harry     | Potter   |
      | Beatrix   | Potter   |
      | George    | Darling  |
      | Wendy     | Darling  |
    Then paging through all owners with size 2 sorted by "name,asc" visits each owner exactly once
