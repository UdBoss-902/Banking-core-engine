import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/config/database.js';

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('⚡ Starting database migrations...');
    const migrationPath = path.join(process.cwd(), 'db', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Database migration 001_initial_schema.sql executed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();