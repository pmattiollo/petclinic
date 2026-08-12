---
applyTo: "**/*.java"
---

# Java code conventions

These rules apply to every `.java` file in this repository (both `petclinic-backend`
main and test sources). They are mandatory, not stylistic suggestions — follow them
even when not explicitly repeated in a task prompt.

## Dependency injection
- Use **constructor injection** in `src/main` (paired with Lombok's `@RequiredArgsConstructor`).
- `@Autowired` is reserved for test code only — never wire dependencies with field
  injection in production classes.

## Transactions
- Apply `@Transactional` only when strictly necessary (e.g. multi-step writes that must
  be atomic). Don't sprinkle it defensively on read-only or single-repository-call methods.

## Mapping
- Use **MapStruct** for entity↔DTO mapping. Don't hand-write mapping code that MapStruct
  can generate; add mapper interfaces under `mapper/` following the existing style.

## Error handling
- Handle exceptions globally via `@RestControllerAdvice` (see
  `rest/error/ExceptionControllerAdvice.java`). Don't catch-and-format errors locally in
  individual controllers.

## Validation
- Apply `@Validated` on every `@RequestBody` parameter in REST controllers so bean
  validation runs before the handler body executes.

## Lombok
- Use **only** these Lombok annotations: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`,
  `@Getter`, `@Setter`. Don't introduce other Lombok annotations (e.g. `@Data`, `@ToString`,
  `@EqualsAndHashCode`, `@Value`) without an explicit reason tied to the task at hand.

## Formatting
- Keep line length **≤ 120 characters**.
- In `@Builder` chains, put **one property per line**, unless the builder only sets two
  properties (in which case a single line is fine).
