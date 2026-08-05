---
name: petclinic-db-cli
description: Query the petclinic Postgres database (owners, pets, vets, visits, types, specialties) by calling the project's Postgres MCP server as a shell command. Use whenever a task needs to read or inspect petclinic data or schema AND no database MCP tools are available (no mcp__postgres-db__* tools). Also use when explicitly asked to "use the petclinic-db-cli skill".
allowed-tools: Bash(scripts/db-via-mcp.sh:*), Bash(jq:*)
---

# Database access when MCP servers are disabled

The `postgres-db` MCP server declared in `.mcp.json` is not connected in this
session. The **same server** is still reachable as an ordinary shell command
via `scripts/db-via-mcp.sh`, a thin wrapper around
[`mcptools`](https://github.com/f/mcptools) — a generic MCP-to-CLI bridge.

Same tools, same parameters, same JSON responses; only the transport differs.
Nothing about the server changes once MCP access is restored.

Run it from the repo root.

## 1. Discover what the server offers

```bash
scripts/db-via-mcp.sh tools
```

Prints every tool with its parameter signature and description — the same
information an MCP client would put in your tool list. Run this first if you
are unsure what is available.

## 2. Call a tool

```bash
scripts/db-via-mcp.sh call <tool_name> --params '<json>'
```

The two tools this server exposes:

```bash
# run SQL
scripts/db-via-mcp.sh call execute_sql \
  --params '{"sql":"select count(*) from owners"}'

# explore the schema without guessing table names
scripts/db-via-mcp.sh call search_objects --params '{"object_type":"table"}'
```

## 3. Keep the output small

The JSON envelope is verbose. Take only the rows:

```bash
scripts/db-via-mcp.sh call execute_sql --params '{"sql":"select name from types"}' \
  | jq -c '.data.statements[0].rows'
```

## Schema cheat-sheet

`owners`, `pets` (`type_id` → `types`, `owner_id` → `owners`), `visits`
(`pet_id`), `vets`, `specialties`, `vet_specialties`, `users`, `roles`.
Full model: see the ER model section in `CLAUDE.md`.

## Rules

- **Read-only.** No INSERT / UPDATE / DELETE / DDL unless explicitly asked.
- Prefer one aggregated SQL query over several small ones — each call pays a
  ~2s server startup.
- An empty database is usually not a bug: Flyway seeds it when the **backend**
  boots (see `CLAUDE.md` → Database).

## Why this and not a direct Postgres client

There is deliberately only **one** way into the database: the `dbhub` MCP
server. It is reachable two ways — as an MCP tool when the harness supports
MCP, and through this CLI wrapper when it does not. Both hit the same server,
so its guardrails and behaviour are identical either way, and switching between
them changes nothing but the transport.
