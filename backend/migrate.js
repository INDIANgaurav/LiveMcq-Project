import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

async function migrate() {
  try {
    console.log('🔄 Starting complete migration...');

    // 1. Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Projects table created');

    // 2. Add admin_id column to questions table if it doesn't exist
    await pool.query(`
      ALTER TABLE questions 
      ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE
    `);
    console.log('✓ Added admin_id to questions table');

    // 3. Add project_id and question_number columns to questions table
    await pool.query(`
      ALTER TABLE questions 
      ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS question_number INTEGER
    `);
    console.log('✓ Added project_id and question_number to questions table');

    // 4. Add activated_at column to questions table
    await pool.query(`
      ALTER TABLE questions 
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
    `);
    console.log('✓ Added activated_at to questions table');

    // 5. Add activated_at column to sub_questions table
    await pool.query(`
      ALTER TABLE sub_questions 
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP
    `);
    console.log('✓ Added activated_at to sub_questions table');

    // 6. Update existing questions to have a default admin_id (first admin)
    const firstAdmin = await pool.query('SELECT id FROM admins LIMIT 1');
    if (firstAdmin.rows.length > 0) {
      await pool.query(`
        UPDATE questions 
        SET admin_id = $1 
        WHERE admin_id IS NULL
      `, [firstAdmin.rows[0].id]);
      console.log('✓ Updated existing questions with admin_id');
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

migrate();
