# RUNBOOK: Resetting a local PetClinic environment

> Copied out of the team wiki. Last edited "a while ago" by someone who has since moved
> teams. This is what a new joiner is handed today.

## When to use this

Use this when your local environment is behaving strangely — the UI shows no owners, the
backend won't start, the database is refusing connections, or you've been debugging long
enough that you no longer trust the state of anything. Also do this before demos.

## Steps

1. Kill whatever is still running from your last session. Check ports 8080, 4200 and 5432.
   Sometimes a backend survives closing the terminal and then nothing else can bind.

2. Start the backend (`./start-backend.sh`). Wait until it says it's up.

3. Start the database (`./start-database.sh`). This one takes a while the first time.

4. Check the database came up correctly by querying the owners table. If it comes back
   empty, the database did not initialise properly — restore from the nightly backup or ask
   in #petclinic-dev.

5. Start the frontend (`./start-frontend.sh`). Open http://localhost:4200 and confirm the
   owners list shows data.

6. If you need traces and dashboards, start Grafana too (`./start-grafana.sh`) and open
   http://localhost:3000. Requires Docker to be running.

7. There is a `./reset-env.sh` at the repo root that is supposed to do all of the above in
   one go, but nobody has kept it working, so do it by hand.

## Credentials

The database user is `petclinic`. Ask Marius for the password, it's in the team vault.

Grafana is admin / admin.

## Troubleshooting

- **Backend fails on startup with a Flyway error** — usually means your schema is from an
  older branch. Wipe the database and start again from step 2.
- **Frontend compiles but the owners page is empty** — check the backend is actually up,
  the frontend fails silently when the API is unreachable.
- **Port 5432 already in use** — you probably have a system Postgres running. Stop it, or
  everything will connect to the wrong database and you will lose an afternoon.

> ⚠️ Note added later: careful with the database start script, it does something
> destructive. I don't remember the details. Check before you run it if you have data you
> care about.
