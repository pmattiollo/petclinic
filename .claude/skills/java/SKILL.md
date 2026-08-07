---
name: java
description: Java coding conventions for this PetClinic project. Apply whenever writing, modifying, or reviewing Java code in this repo.
---

# Java Code Preferences

- Constructor injection for production, `@Autowired` only in tests ✅⇒sonar,refaster openrewrite recipe
- Do not create Spring-managed beans when Spring facilities are not needed; prefer static utility methods in `*Helper` classes for pure logic.
- For helper classes with only static methods, do not add private constructors.
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use only Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively ✅
- Keep line length ≤ 120 chars ✅⇒SONAR,linter,.sh
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total

