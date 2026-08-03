---
name: java
description: The owner's Java code preferences for this repo — Spring/Lombok/MapStruct conventions, formatting, and style rules. Load automatically BEFORE writing, editing, or reviewing any Java code (`*.java`) in this repo, including test code, and before reviewing a diff that touches Java.
---

# Java code preferences

Apply these on the **first pass**, not after being corrected.

## Spring & framework

- Constructor injection for production code (`@RequiredArgsConstructor`); `@Autowired` only in tests.
- `@Transactional` only when strictly necessary.
- MapStruct for DTO mapping.
- Global exception handling in `@RestControllerAdvice`.
- `@Validated` on `@RequestBody`.
- Lombok: only `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter`, used selectively.

## Formatting

- Indent with **4 spaces** (`.editorconfig` sets `indent_size = 4` for `*.java` and `*.xml`, overriding the 2-space default).
- Line length ≤ 120 chars.
- Builder chains: one property per line, unless there are only 2 properties total.
- Ternary only if the whole expression fits in half a line (~60 chars); otherwise use `if`/`else`.

## API style

- Don't return `Stream` from a method — return `List`. `Stream` returns are reserved for humongous data.
- Prefer explanatory variable and method names over comments; keep comments concise.

## Workflow

- Write non-trivial code using TDD: a failing test first for real logic. Skip ceremony tests for cosmetic or mechanical edits.
- Always run the tests after any refactoring — never ask permission first.
