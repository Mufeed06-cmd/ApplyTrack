const mysql = require('mysql2/promise');
require('dotenv').config();

// MySQL connection pool using environment variables
// Supports local credentials as well as Railway deployment variables
const pool = mysql.createPool(
  process.env.DATABASE_URL || process.env.MYSQL_URL || {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'applytrack',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  }
);

module.exports = pool;
