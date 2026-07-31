Feature: Owners are browsed one page at a time

  Acceptance criteria of the "add-owners-grid-pagination" change: the owners list is
  paged, sorted through a whitelist of two keys, and stable across pages.

  Background:
    Given the following owners exist:
      | firstName | lastName | city   |
      | Ana       | Adams    | London |
      | Bob       | Baker    | Paris  |
      | Cara      | Clark    | London |
      | Betty     | Davis    | Zurich |
      | Harold    | Davis    | Zurich |
      | Eve       | Evans    | Athens |
      | Finn      | Foster   | London |
      | Gina      | Green    | Berlin |
      | Hugo      | Hall     | Paris  |
      | Ivy       | Irwin    | Cairo  |
      | Jack      | Jones    | Dublin |
      | Kim       | King     | Athens |

  Scenario: Default request returns the first page
    When I GET "/api/owners"
    Then the response status is 200
    And the response JSON array has size 10
    And the page reports number 0, size 10 and totalElements 12

  Scenario: Explicit page is requested
    When I GET "/api/owners?page=2&size=5"
    Then the response status is 200
    And the page reports number 2, size 5 and totalElements 12
    And the owners in the response are, in order:
      | lastName | firstName |
      | Jones    | Jack      |
      | King     | Kim       |

  Scenario: Page beyond the last one
    When I GET "/api/owners?page=9&size=5"
    Then the response status is 200
    And the response JSON array has size 0
    And the page reports number 9, size 5 and totalElements 12

  Scenario: Supported page size
    When I GET "/api/owners?size=20"
    Then the response status is 200
    And the page reports number 0, size 20 and totalElements 12

  Scenario: Unsupported page size falls back to the default
    When I GET "/api/owners?size=1000"
    Then the response status is 200
    And the response JSON array has size 10
    And the page reports number 0, size 10 and totalElements 12

  Scenario: Sort by name ascending is the default
    When I GET "/api/owners?size=5"
    Then the owners in the response are, in order:
      | lastName | firstName |
      | Adams    | Ana       |
      | Baker    | Bob       |
      | Clark    | Cara      |
      | Davis    | Betty     |
      | Davis    | Harold    |

  Scenario: Sort by city ascending orders names ascending inside each city
    When I GET "/api/owners?size=5&sort=city,asc"
    Then the owners in the response are, in order:
      | lastName | firstName |
      | Evans    | Eve       |
      | King     | Kim       |
      | Green    | Gina      |
      | Irwin    | Ivy       |
      | Jones    | Jack      |

  Scenario: Sort by city descending keeps names ascending
    When I GET "/api/owners?size=5&sort=city,desc"
    Then the owners in the response are, in order:
      | lastName | firstName |
      | Davis    | Betty     |
      | Davis    | Harold    |
      | Baker    | Bob       |
      | Hall     | Hugo      |
      | Adams    | Ana       |

  Scenario: Sorting by a non-whitelisted column falls back to the default sort
    When I GET "/api/owners?size=5&sort=telephone,desc"
    Then the response status is 200
    And the owners in the response are, in order:
      | lastName | firstName |
      | Adams    | Ana       |
      | Baker    | Bob       |
      | Clark    | Cara      |
      | Davis    | Betty     |
      | Davis    | Harold    |

  Scenario: A sort key naming a nested path falls back to the default sort
    When I GET "/api/owners?size=5&sort=pets.visits.description,asc"
    Then the response status is 200
    And the owners in the response are, in order:
      | lastName | firstName |
      | Adams    | Ana       |
      | Baker    | Bob       |
      | Clark    | Cara      |
      | Davis    | Betty     |
      | Davis    | Harold    |

  Scenario: Walking all pages returns every owner exactly once
    When I read every page of size 5 from "/api/owners?sort=city,asc"
    Then each owner appears exactly once, 12 in total

  Scenario: Search narrows the result set before paging
    When I GET "/api/owners?lastName=Dav"
    Then the response status is 200
    And the response JSON array has size 2
    And the page reports number 0, size 10 and totalElements 2

  Scenario: Ordering follows natural-language rules, not byte order
    Given the following owners exist:
      | firstName | lastName | city    |
      | Alan      | Adamson  | Uppsala |
      | Anders    | Ångström | Uppsala |
      | Dirk      | de Vries | Uppsala |
      | Emile     | Émile    | Uppsala |
      | Ozan      | Öztürk   | Uppsala |
      | Vincent   | van Gogh | Uppsala |
      | Zoe       | Zamfir   | Uppsala |
    When I GET "/api/owners?size=20"
    Then the owners in the response appear in this relative order:
      | Adamson  |
      | Ångström |
      | de Vries |
      | Émile    |
      | Öztürk   |
      | van Gogh |
      | Zamfir   |
