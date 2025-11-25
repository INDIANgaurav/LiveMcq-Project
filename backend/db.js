import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Use DATABASE_URL for production (Render) or individual credentials for local
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('Using connection:', process.env.DATABASE_URL ? 'DATABASE_URL' : 'Individual credentials');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

// Create tables
const initDB = async () => {
  // Create admins table first (no dependencies)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sessions table (depends on admins)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      session_code VARCHAR(50) UNIQUE NOT NULL,
      admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
      admin_name VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create questions table (depends on admins)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
      heading VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create options table (depends on questions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      option_text VARCHAR(255) NOT NULL
    )
  `);

  // Create sub_questions table (depends on questions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_questions (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      sub_question_text TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT false
    )
  `);

  // Create sub_options table (depends on sub_questions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_options (
      id SERIAL PRIMARY KEY,
      sub_question_id INTEGER REFERENCES sub_questions(id) ON DELETE CASCADE,
      option_text VARCHAR(255) NOT NULL
    )
  `);

  // Create votes table (depends on questions and options)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      option_id INTEGER REFERENCES options(id) ON DELETE CASCADE,
      user_ip VARCHAR(50),
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sub_votes table (depends on sub_questions and sub_options)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_votes (
      id SERIAL PRIMARY KEY,
      sub_question_id INTEGER REFERENCES sub_questions(id) ON DELETE CASCADE,
      sub_option_id INTEGER REFERENCES sub_options(id) ON DELETE CASCADE,
      user_ip VARCHAR(50),
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database tables created successfully');
};

initDB().catch(console.error);

export default pool;
