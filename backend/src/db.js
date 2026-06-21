const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

module.exports = pool;
