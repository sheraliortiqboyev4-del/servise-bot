import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({ 
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

// Oddiy query helper
export function query(text, params) {
  return pool.query(text, params);
}

// Tranzaksiya helper (DB-level lock uchun ishlatiladi)
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
