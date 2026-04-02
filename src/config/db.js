const mysql = require('mysql2/promise');

function createDbPool(config) {
  if (!config.name || !config.user) {
    return null;
  }

  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

module.exports = {
  createDbPool,
};
