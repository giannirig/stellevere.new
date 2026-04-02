const express = require('express');
const path = require('path');
const { getEnv } = require('./config/env');
const { createDbPool } = require('./config/db');
const { createTwilioConfig } = require('./config/twilio');
const { attachRequestContext } = require('./middleware/request-context');
const { createPublicRouter } = require('./routes/public');
const { createArtisanDashboardRouter } = require('./routes/artisan-dashboard');
const { createAdminRouter } = require('./routes/admin');
const { createApiRouter } = require('./routes/api');

function createApp() {
  const env = getEnv();
  const dbPool = createDbPool(env.db);
  const twilio = createTwilioConfig(env);
  const appContext = { env, dbPool, twilio };

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/assets', express.static(path.join(__dirname, 'assets')));
  app.use(attachRequestContext(appContext));

  app.use(createPublicRouter(appContext));
  app.use(createArtisanDashboardRouter(appContext));
  app.use(createAdminRouter(appContext));
  app.use(createApiRouter(appContext));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
      success: false,
      message: env.nodeEnv === 'production' ? 'Errore interno' : err.message,
    });
  });

  return { app, env, appContext };
}

async function start() {
  const { app, env, appContext } = createApp();

  if (appContext.dbPool) {
    try {
      await appContext.dbPool.query('SELECT 1');
      console.log('[v2] Database MySQL connesso');
    } catch (error) {
      console.warn('[v2] Database non raggiungibile, il server parte comunque:', error.message);
    }
  } else {
    console.warn('[v2] Config DB incompleta, server avviato senza connessione MySQL');
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[v2] StelleVere listening on http://localhost:${env.port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  createApp,
  start,
};
