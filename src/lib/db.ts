import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const isNeon = Boolean(connectionString && /neon\.tech/i.test(connectionString));

const pool = new Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
});

export async function query<T = unknown>(text: string, params: Array<unknown> = []) {
  return pool.query<T>(text, params);
}

export async function getClient() {
  return pool.connect();
}
