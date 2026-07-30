---
name: java
description: The Java/Spring style preferences for the PetClinic Java code. Use whenever you write, refactor, or review Java code so it follows the way the team likes their Java written. Not relevant to frontend/TypeScript or other non-Java work.
---

# Java code style — how Victor likes his Java

Apply these whenever writing, generating, refactoring, or reviewing **Java** code
in this repository. These are hard preferences, not suggestions.

## Dependency injection
- Constructor injection for production code (Lombok `@RequiredArgsConstructor` + `final` fields).
- `@Autowired` only in tests — never for production field injection.

## Spring conventions
- `@Transactional` only when strictly necessary — do not annotate by default.
- Use **MapStruct** for entity ↔ DTO mapping.
- Global exception handling belongs in an `@RestControllerAdvice`, not in individual controllers.
- Put `@Validated` on `@RequestBody` parameters to trigger bean validation.

## Lombok
- Use **only** these Lombok annotations, and selectively:
  `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter`.
- Do not reach for other Lombok annotations.

## Formatting
- Keep line length ≤ 120 characters.
- Builder chains: one property per line — unless there are only 2 properties total,
  in which case a single line is fine.

## Testing
- Never ask before running tests after refactoring — just run them.
- am un Ferrari rosu
