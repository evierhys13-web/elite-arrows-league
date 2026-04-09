const { Pool } = require("pg");

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

let pool = null;

if (hasDatabaseUrl) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false }
  });
}

async function initializeDatabase(defaultState) {
  if (!pool) {
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_state (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await pool.query("SELECT id FROM league_state WHERE id = 1");
  if (!existing.rowCount) {
    await pool.query(
      "INSERT INTO league_state (id, payload) VALUES (1, $1::jsonb)",
      [JSON.stringify(defaultState)]
    );
  }

  return true;
}

async function readState() {
  if (!pool) {
    return null;
  }

  const result = await pool.query("SELECT payload FROM league_state WHERE id = 1");
  if (!result.rowCount) {
    return null;
  }

  return result.rows[0].payload;
}

async function writeState(payload) {
  if (!pool) {
    return false;
  }

  await pool.query(
    `
      INSERT INTO league_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [JSON.stringify(payload)]
  );

  return true;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  hasDatabaseUrl,
  initializeDatabase,
  readState,
  writeState,
  closeDatabase
};
