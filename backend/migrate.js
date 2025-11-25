import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  try {
    console.log('Starting migration...');

    // Add admin_id column to questions table if it doesn't exist
    await pool.query(`
      ALTER TABLE questions 
      ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE
    `);
    console.log('✓ Added admin_id to questions table');

    // Update existing questions to have a default admin_id (first admin)
    const firstAdmin = await pool.query('SELECT id FROM admins LIMIT 1');
    if (firstAdmin.rows.length > 0) {
      await pool.query(`
        UPDATE questions 
        SET admin_id = $1 
        WHERE admin_id IS NULL
      `, [firstAdmin.rows[0].id]);
      console.log('✓ Updated existing questions with admin_id');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error.message);
    process.exit(1);
  }
}

migrate();
