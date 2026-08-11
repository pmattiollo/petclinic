---
paths:
  - "**/*.java"
---

# Java code preferences (petclinic)

Non-negotiable house style for every `.java` file you read, write, review or refactor.
Apply on the **first** pass — never wait to be corrected.

## Spring wiring

1. **Constructor injection in `src/main`.** Use Lombok's `@RequiredArgsConstructor` over
   `private final` fields. `@Autowired` is allowed **only in tests**.
2. **`@Transactional` only when strictly necessary.** Not a decoration on every service
   method — add it when more than one write must commit or roll back together, or when a
   lazy association is genuinely traversed outside the repository call.
3. **`@Validated` on every `@RequestBody`.** No exceptions; a controller taking an
   unvalidated body is a bug.
4. **Errors are handled globally**, in the `@RestControllerAdvice`. Do not add per-controller
   `try/catch` that maps exceptions to responses — throw and let the advice translate.

## DTOs and mapping

5. **MapStruct does entity↔DTO conversion.** Add a mapper method rather than hand-copying
   fields in a controller. Mapper implementations are generated into
   `target/generated-sources/annotations/` — run `mvn clean install` after changing an
   interface; never edit the generated `*MapperImpl`.

## Lombok

6. **Only these annotations:** `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`,
   `@Getter`/`@Setter`. Anything else (`@Data`, `@Value`, `@AllArgsConstructor`,
   `@SneakyThrows`, `@EqualsAndHashCode`, …) is out.

## Formatting

7. **Indent 4 spaces** — the repo `.editorconfig` overrides Java (and XML) to
   `indent_size = 4`. Do not default to 2.
8. **Line length ≤ 120 chars.**
9. **Builder chains: one property per line**, unless only two properties are set (then one
   line is fine):

   ```java
   Owner owner = Owner.builder()
       .firstName(firstName)
       .lastName(lastName)
       .city(city)
       .build();

   Pet pet = Pet.builder().name(name).type(type).build();   // 2 properties → one line OK
   ```

## Language style

10. **Do not return `Stream` from a method** — return `List`. A `Stream` return is justified
    only for humongous data that must not be materialized.
11. **No ternary unless it fits in half a line** (~60 chars). Anything longer becomes
    `if`/`else`; readability beats compactness.
12. **Comments are concise** — prefer an explanatory variable or method name over a comment
    that restates the code.

## Layering reminder

Requests flow **REST controller → repository / MapStruct mapper → JPA entity**. There is
deliberately **no service layer**; do not introduce one as a side effect of another change.
