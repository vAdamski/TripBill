import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://tripbill:tripbill@localhost:5432/tripbill',
  max: Number(process.env.PG_POOL_SIZE || 10),
})

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trip_records (
      id VARCHAR(10) PRIMARY KEY CHECK (id ~ '^[A-Z0-9]{10}$'),
      payload TEXT NOT NULL,
      encrypted BOOLEAN NOT NULL DEFAULT FALSE,
      salt TEXT,
      iv TEXT,
      auth_tag TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}
