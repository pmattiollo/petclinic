# Backend Memory — petclinic-backend (Spring Boot 3.5, Java 21)

Loaded only when working inside `petclinic-backend/`. Repo-wide facts stay in the root
[CLAUDE.md](../CLAUDE.md); Java house style is enforced by the always-on rule
`.claude/rules/java-code-preferences.md`.

## Architecture

**Layered structure** (paths relative to `src/main/java/.../`):
1. REST Controllers (`rest/`) — expose API endpoints
2. Mappers (`mapper/`) — MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) — Spring Data JPA interfaces (**no service layer!**)
4. Domain Model (`model/`) — JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Data flow:**
```
Request  → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO)  ← Repository
```

**Generated code:**
- MapStruct mapper implementations → `target/generated-sources/annotations/`
- Regenerate via `mvn clean install`

**Key patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at the **repo root** is generated output (from `OpenApiExtractorTest`),
  not a source spec — it is kept in sync with the Java API by tests
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via
  `@RestControllerAdvice`
