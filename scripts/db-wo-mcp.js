#!/usr/bin/env node
// Ad-hoc SQL against the local petclinic Postgres — without psql and without an MCP server.
// For agent CLIs where external MCP servers are disabled by org policy: this is plain
// project code the agent can run through the shell.
//
//   node scripts/db-wo-mcp.js "select * from pets limit 5"
//   node scripts/db-wo-mcp.js --json "select id, name from vets"
//   echo "select count(*) from owners" | node scripts/db-wo-mcp.js
//
// Setup once:  cd scripts && npm install
// Connection:  $DATABASE_URL, defaulting to the local petclinic database.
const { Client } = require('pg');

const DEFAULT_DSN = 'postgres://petclinic:petclinic@localhost:5432/petclinic';

function readStdin() {
  return new Promise(resolve => {
    let s = '';
    process.stdin.on('data', d => s += d).on('end', () => resolve(s));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args[0] === '--json' && args.shift();

  const sql = args.join(' ').trim() || (await readStdin()).trim();
  if (!sql) {
    console.error('usage: node scripts/db-wo-mcp.js [--json] "<SQL>"   (or pipe SQL on stdin)');
    process.exit(2);
  }

  const client = new Client(process.env.DATABASE_URL || DEFAULT_DSN);
  await client.connect();
  try {
    const res = await client.query(sql);
    for (const r of (Array.isArray(res) ? res : [res])) {
      if (!r.rows || r.rows.length === 0) console.log(`${r.command || 'OK'}: ${r.rowCount || 0} row(s)`);
      else if (asJson) console.log(JSON.stringify(r.rows, null, 2));
      else console.table(r.rows);
    }
  } catch (e) {
    console.error('SQL error:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
