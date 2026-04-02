const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getEnv } = require('../config/env');
const { createDbPool } = require('../config/db');
const { slugify } = require('../services/slug-service');
const { detectPhoneType } = require('../services/phone-service');

function extractLegacyArtigiani() {
  const serverPath = path.join(process.cwd(), 'server.js');
  const source = fs.readFileSync(serverPath, 'utf8');
  const startToken = 'const ARTIGIANI = ';
  const startIndex = source.indexOf(startToken);
  if (startIndex < 0) {
    throw new Error('Impossibile trovare il blocco ARTIGIANI in server.js');
  }

  const openBraceIndex = source.indexOf('{', startIndex);
  let depth = 0;
  let endIndex = -1;

  for (let i = openBraceIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex < 0) {
    throw new Error('Impossibile estrarre l\'oggetto ARTIGIANI da server.js');
  }

  const objectLiteral = source.slice(openBraceIndex, endIndex + 1);
  const sandbox = {};
  const script = new vm.Script(`ARTIGIANI = ${objectLiteral};`);
  script.runInNewContext(sandbox);
  return sandbox.ARTIGIANI;
}

async function loadCategoryMap(pool) {
  const [rows] = await pool.query('SELECT id, slug FROM categorie');
  return rows.reduce((acc, row) => {
    acc[row.slug] = row.id;
    return acc;
  }, {});
}

async function importArtigiani() {
  const env = getEnv();
  const pool = createDbPool(env.db);
  if (!pool) {
    throw new Error('Config database mancante: compila prima il file .env');
  }

  const legacy = extractLegacyArtigiani();
  const categories = await loadCategoryMap(pool);

  for (const artigiano of Object.values(legacy)) {
    const categoriaSlug = artigiano.cat_slug || 'altro';
    const categoriaId = categories[categoriaSlug];
    if (!categoriaId) {
      throw new Error(`Categoria non trovata nel database: ${categoriaSlug}`);
    }

    await pool.query(`
      INSERT INTO artigiani (
        slug,
        nome,
        ragione_sociale,
        source,
        telefono,
        telefono_tipo,
        categoria_principale_id,
        citta_principale,
        quartiere_principale,
        bio,
        claim_status,
        rating_avg,
        reviews_count,
        jobs_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nome = VALUES(nome),
        ragione_sociale = VALUES(ragione_sociale),
        source = VALUES(source),
        telefono = VALUES(telefono),
        telefono_tipo = VALUES(telefono_tipo),
        categoria_principale_id = VALUES(categoria_principale_id),
        citta_principale = VALUES(citta_principale),
        quartiere_principale = VALUES(quartiere_principale),
        bio = VALUES(bio),
        claim_status = VALUES(claim_status),
        rating_avg = VALUES(rating_avg),
        reviews_count = VALUES(reviews_count),
        jobs_count = VALUES(jobs_count)
    `, [
      artigiano.id || slugify(artigiano.nome),
      artigiano.nome,
      artigiano.nome,
      'google_maps',
      artigiano.telefono || '',
      detectPhoneType(artigiano.telefono || ''),
      categoriaId,
      artigiano.citta || '',
      '',
      '',
      'unclaimed',
      Number(artigiano.stelle || 0),
      Number(artigiano.recensioni || 0),
      Array.isArray(artigiano.lavori) ? artigiano.lavori.length : 0,
    ]);
  }

  await pool.end();
  console.log(`Import completato: ${Object.keys(legacy).length} artigiani sincronizzati`);
}

importArtigiani().catch(error => {
  console.error(error.message);
  process.exit(1);
});
