# PRD: Improve Owners Search (GitHub Issue #24)

Source: https://github.com/victorrentea/petclinic/issues/24

## Summary

Replace the current lastName prefix search with a live, full-text search across all visible columns in the Owners list.

## Decisions

### Search behavior
- Search is **server-side**
- Semantics: **contains, case-insensitive**
- **Trim** the search string in the controller before passing to repository
- Searching across all visible columns: `firstName`, `lastName`, `address`, `city`, `telephone`, and pet `name`
- Empty search string → returns all owners

### API
- Query param renamed: `?lastName=` → `?search=`
- No backwards compatibility needed (only frontend consumes this endpoint)

### Backend implementation
- Custom JPQL query using `LOWER()` + `LIKE '%...%'` + `DISTINCT`
- `LEFT JOIN o.pets p` to include pet names in search
- Trim done in controller: `search.trim()`

```java
@Query("""
  SELECT DISTINCT o FROM Owner o LEFT JOIN o.pets p
  WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :search, '%'))
     OR LOWER(o.lastName)  LIKE LOWER(CONCAT('%', :search, '%'))
     OR LOWER(o.address)   LIKE LOWER(CONCAT('%', :search, '%'))
     OR LOWER(o.city)      LIKE LOWER(CONCAT('%', :search, '%'))
     OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :search, '%'))
     OR LOWER(p.name)      LIKE LOWER(CONCAT('%', :search, '%'))
  """)
List<Owner> searchAcrossAllFields(@Param("search") String search);
```

### Frontend implementation
- Search is **live** (no button click required), triggered on every input change
- **Debounce: 300ms** after last keystroke before sending request
- "Find Owner" button **removed**
- "Add Owner" button **kept**
- Label changed from "Last name" to "Search"
- Placeholder: descriptive (e.g. "Search by name, address, city, telephone or pet...")
- No-results message updated: `No owners found for "{{search}}"`

## Acceptance Criteria

- [ ] Single search input filters the owners table across all visible columns
- [ ] Matching is case-insensitive and uses contains semantics
- [ ] Search string is trimmed before querying
- [ ] Search is triggered live with 300ms debounce (no button)
- [ ] Empty search shows all owners
- [ ] Pet names are included in the search
- [ ] API uses `?search=` param instead of `?lastName=`
- [ ] UI copy updated (label, placeholder, no-results message)
