 
 

import dotenv from 'dotenv';
dotenv.config();

// DEVELOPMENT (Local)
const DEV_CONFIG = {
  PORT: 5000,
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE: {
    user: 'postgres',
    host: 'localhost',
    database: 'LiveMcq',
    password: '12345',
    port: 5432
  }
};

// PRODUCTION (Deployed)
const PROD_CONFIG = {
  PORT: process.env.PORT || 5000,
  FRONTEND_URL: 'https://live-mcq-tool.vercel.app',
  DATABASE_URL: process.env.DATABASE_URL
};

// Auto-detect or use environment variable
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render'));
const CONFIG = IS_PRODUCTION ? PROD_CONFIG : DEV_CONFIG;

// Export configuration
export const PORT = CONFIG.PORT;
export const FRONTEND_URL = process.env.FRONTEND_URL || CONFIG.FRONTEND_URL;
export const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
export const DATABASE_CONFIG = IS_PRODUCTION 
  ? { connectionString: CONFIG.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : CONFIG.DATABASE;

// Debug log
console.log('🔧 Environment:', IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT');
console.log('🌐 Frontend URL:', FRONTEND_URL);
console.log('🗄️  Database:', IS_PRODUCTION ? 'Production DB' : 'Local DB');

export default {
  PORT,
  FRONTEND_URL,
  JWT_SECRET,
  DATABASE_CONFIG,
  IS_PRODUCTION
};
