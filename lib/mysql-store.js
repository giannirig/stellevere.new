const mysql = require('mysql2/promise');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return null;
}

function findColumn(columns, candidates) {
  return candidates.find(candidate => columns.includes(candidate)) || null;
}

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') return clone(fallback);
  if (typeof value === 'object') return clone(value);
  try {
    return JSON.parse(value);
  } catch (_) {
    return clone(fallback);
  }
}

function mapCategoryLabel(catSlug, categorie) {
  return categorie[catSlug]?.cat_tipo || 'Artigiano';
}

function deriveCatSlug(rawValue, categorie) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return 'altro';

  const bySlug = Object.keys(categorie).find(slug => slug === value);
  if (bySlug) return bySlug;

  const byLabel = Object.entries(categorie).find(([, item]) => {
    return String(item.nome || '').toLowerCase() === value || String(item.cat_tipo || '').toLowerCase() === value;
  });
  return byLabel ? byLabel[0] : 'altro';
}

function getDbConfig(env) {
  const host = env.DB_HOST || env.MYSQL_HOST || '';
  const user = env.DB_USER || env.MYSQL_USER || '';
  const password = env.DB_PASSWORD || env.MYSQL_PASSWORD || '';
  const database = env.DB_NAME || env.MYSQL_DATABASE || '';
  const port = Number(env.DB_PORT || env.MYSQL_PORT || 3306);

  if (!host || !user || !database) return null;

  return {
    host,
    user,
    password,
    database,
    port,
  };
}

async function loadTableColumns(pool, database, tableName) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?`,
    [database, tableName]
  );
  return rows.map(row => row.COLUMN_NAME);
}

function buildSchemas(columnsByTable) {
  const artigianiCols = columnsByTable.artigiani || [];
  const lavoriCols = columnsByTable.lavori || [];
  const recensioniCols = columnsByTable.recensioni || [];

  return {
    artigiani: {
      table: 'artigiani',
      columns: artigianiCols,
      id: findColumn(artigianiCols, ['id', 'slug', 'artigiano_id', 'username']),
      nome: findColumn(artigianiCols, ['nome', 'name', 'ragione_sociale']),
      categoria: findColumn(artigianiCols, ['categoria', 'category']),
      catSlug: findColumn(artigianiCols, ['cat_slug', 'categoria_slug', 'category_slug']),
      citta: findColumn(artigianiCols, ['citta', 'city']),
      stelle: findColumn(artigianiCols, ['stelle', 'rating', 'media_stelle']),
      recensioni: findColumn(artigianiCols, ['recensioni', 'reviews_count', 'numero_recensioni']),
      telefono: findColumn(artigianiCols, ['telefono', 'phone', 'telefono_whatsapp']),
    },
    lavori: {
      table: 'lavori',
      columns: lavoriCols,
      id: findColumn(lavoriCols, ['id', 'lavoro_id']),
      artigianoId: findColumn(lavoriCols, ['artigiano_id', 'artigianoId', 'user_id', 'owner_id']),
      titolo: findColumn(lavoriCols, ['titolo', 'title']),
      descrizione: findColumn(lavoriCols, ['descrizione', 'description']),
      citta: findColumn(lavoriCols, ['citta', 'city']),
      quartiere: findColumn(lavoriCols, ['quartiere', 'zona', 'district']),
      sottocategoriaSlug: findColumn(lavoriCols, ['sottocategoria_slug', 'subcategory_slug', 'subcat_slug']),
      sottocategoria: findColumn(lavoriCols, ['sottocategoria', 'subcategory']),
      stelle: findColumn(lavoriCols, ['stelle', 'rating']),
      visite: findColumn(lavoriCols, ['visite', 'views']),
      recensione: findColumn(lavoriCols, ['recensione', 'review_text']),
      cliente: findColumn(lavoriCols, ['cliente', 'cliente_nome', 'review_author']),
      data: findColumn(lavoriCols, ['data', 'created_at', 'published_at']),
      dataRecensione: findColumn(lavoriCols, ['data_recensione', 'reviewed_at']),
      immagini: findColumn(lavoriCols, ['immagini', 'images', 'foto']),
      gps: findColumn(lavoriCols, ['gps', 'coords_json']),
      gpsLat: findColumn(lavoriCols, ['gps_lat', 'latitudine', 'latitude']),
      gpsLng: findColumn(lavoriCols, ['gps_lng', 'longitudine', 'longitude']),
      fotoGps: findColumn(lavoriCols, ['foto_gps', 'photo_gps']),
      gpsCheck: findColumn(lavoriCols, ['gps_check', 'gps_validation']),
    },
    recensioni: {
      table: 'recensioni',
      columns: recensioniCols,
      id: findColumn(recensioniCols, ['id', 'recensione_id']),
      artigianoId: findColumn(recensioniCols, ['artigiano_id', 'artigianoId', 'user_id']),
      lavoroId: findColumn(recensioniCols, ['lavoro_id', 'lavoroId', 'job_id']),
      cliente: findColumn(recensioniCols, ['cliente', 'cliente_nome', 'author']),
      recensione: findColumn(recensioniCols, ['recensione', 'testo', 'review_text']),
      stelle: findColumn(recensioniCols, ['stelle', 'rating']),
      data: findColumn(recensioniCols, ['data_recensione', 'data', 'created_at']),
    },
  };
}

function buildArtigianoFromRow(row, schema, categorie) {
  const catSlug = deriveCatSlug(firstDefined(row, [schema.catSlug, schema.categoria]), categorie);
  const id = String(firstDefined(row, [schema.id]) || '').trim();
  if (!id) return null;

  return {
    id,
    nome: String(firstDefined(row, [schema.nome]) || id),
    categoria: String(firstDefined(row, [schema.categoria]) || mapCategoryLabel(catSlug, categorie)),
    cat_slug: catSlug,
    citta: String(firstDefined(row, [schema.citta]) || ''),
    stelle: Number(firstDefined(row, [schema.stelle])) || 5,
    recensioni: Number(firstDefined(row, [schema.recensioni])) || 0,
    telefono: String(firstDefined(row, [schema.telefono]) || ''),
    lavori: [],
  };
}

function normalizeGpsFromRow(row, schema) {
  const rawGps = schema.gps ? row[schema.gps] : null;
  if (rawGps) {
    const parsed = parseJsonField(rawGps, null);
    if (parsed && Number.isFinite(Number(parsed.lat)) && Number.isFinite(Number(parsed.lng))) {
      return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
    }
  }

  const lat = schema.gpsLat ? Number(row[schema.gpsLat]) : NaN;
  const lng = schema.gpsLng ? Number(row[schema.gpsLng]) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

function buildLavoroFromRow(row, schema) {
  const id = firstDefined(row, [schema.id]);
  const artigianoId = String(firstDefined(row, [schema.artigianoId]) || '').trim();
  if (id === null || !artigianoId) return null;

  return {
    id: Number(id) || id,
    artigiano_id: artigianoId,
    titolo: String(firstDefined(row, [schema.titolo]) || ''),
    descrizione: String(firstDefined(row, [schema.descrizione]) || ''),
    citta: String(firstDefined(row, [schema.citta]) || ''),
    quartiere: String(firstDefined(row, [schema.quartiere]) || ''),
    sottocategoria_slug: String(firstDefined(row, [schema.sottocategoriaSlug]) || ''),
    sottocategoria: String(firstDefined(row, [schema.sottocategoria]) || ''),
    stelle: Number(firstDefined(row, [schema.stelle])) || 5,
    visite: Number(firstDefined(row, [schema.visite])) || 0,
    recensione: String(firstDefined(row, [schema.recensione]) || ''),
    cliente: String(firstDefined(row, [schema.cliente]) || ''),
    data: firstDefined(row, [schema.data]) ? String(firstDefined(row, [schema.data])).slice(0, 10) : '',
    data_recensione: firstDefined(row, [schema.dataRecensione]) ? String(firstDefined(row, [schema.dataRecensione])).slice(0, 10) : '',
    immagini: parseJsonField(schema.immagini ? row[schema.immagini] : null, []),
    gps: normalizeGpsFromRow(row, schema),
    foto_gps: parseJsonField(schema.fotoGps ? row[schema.fotoGps] : null, []),
    gps_check: parseJsonField(schema.gpsCheck ? row[schema.gpsCheck] : null, null),
  };
}

function applyRecensioniRows(artigiani, rows, schema) {
  if (!schema.lavoroId || !schema.artigianoId) return;

  for (const row of rows) {
    const artigianoId = String(firstDefined(row, [schema.artigianoId]) || '').trim();
    const lavoroId = firstDefined(row, [schema.lavoroId]);
    const artigiano = artigiani[artigianoId];
    if (!artigiano) continue;
    const lavoro = artigiano.lavori.find(item => String(item.id) === String(lavoroId));
    if (!lavoro) continue;

    if (!lavoro.cliente && schema.cliente) lavoro.cliente = String(row[schema.cliente] || '');
    if (!lavoro.recensione && schema.recensione) lavoro.recensione = String(row[schema.recensione] || '');
    if ((!lavoro.stelle || lavoro.stelle === 5) && schema.stelle) {
      lavoro.stelle = Number(row[schema.stelle]) || lavoro.stelle || 5;
    }
    if (!lavoro.data_recensione && schema.data) {
      lavoro.data_recensione = String(row[schema.data] || '').slice(0, 10);
    }
  }
}

function mapToTargetColumns(payload, mapping) {
  const columns = [];
  const values = [];
  for (const [column, value] of Object.entries(mapping)) {
    if (!column || value === undefined) continue;
    columns.push(column);
    values.push(value);
  }
  return { columns, values };
}

function updateTargetRecord(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'lavori') continue;
    if (value !== undefined && value !== null && value !== '') {
      target[key] = value;
    }
  }
}

function createMysqlStore({ env, categorie, logger = console }) {
  const dbConfig = getDbConfig(env);
  if (!dbConfig) {
    return {
      enabled: false,
      async syncData() {
        return { enabled: false, reason: 'missing-config' };
      },
      async saveJob() {
        return false;
      },
      async saveReview() {
        return false;
      },
      getStatus() {
        return { enabled: false, reason: 'missing-config' };
      },
    };
  }

  let pool = null;
  let schemas = null;
  let lastError = null;

  async function ensureReady() {
    if (pool && schemas) return true;

    try {
      pool = mysql.createPool({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      });

      await pool.query('SELECT 1');
      const columnsByTable = {};
      for (const tableName of ['artigiani', 'lavori', 'recensioni']) {
        columnsByTable[tableName] = await loadTableColumns(pool, dbConfig.database, tableName);
      }
      schemas = buildSchemas(columnsByTable);
      lastError = null;
      return true;
    } catch (error) {
      lastError = error;
      if (pool) {
        try {
          await pool.end();
        } catch (_) {}
      }
      pool = null;
      schemas = null;
      logger.warn('[mysql] Connessione non disponibile, resto sul fallback locale:', error.message);
      return false;
    }
  }

  async function syncData(localArtigiani) {
    if (!(await ensureReady())) {
      return { enabled: false, reason: lastError ? lastError.message : 'connection-failed' };
    }

    const [artigianiRows] = await pool.query('SELECT * FROM artigiani');
    const merged = {};

    for (const [id, artigiano] of Object.entries(localArtigiani)) {
      merged[id] = clone(artigiano);
    }

    for (const row of artigianiRows) {
      const incoming = buildArtigianoFromRow(row, schemas.artigiani, categorie);
      if (!incoming) continue;
      if (!merged[incoming.id]) merged[incoming.id] = incoming;
      else updateTargetRecord(merged[incoming.id], incoming);
    }

    if (schemas.lavori.id && schemas.lavori.artigianoId) {
      const [lavoriRows] = await pool.query('SELECT * FROM lavori');
      for (const row of lavoriRows) {
        const lavoro = buildLavoroFromRow(row, schemas.lavori);
        if (!lavoro) continue;
        if (!merged[lavoro.artigiano_id]) {
          merged[lavoro.artigiano_id] = {
            id: lavoro.artigiano_id,
            nome: lavoro.artigiano_id,
            categoria: 'Artigiano',
            cat_slug: 'altro',
            citta: lavoro.citta || '',
            stelle: 5,
            recensioni: 0,
            telefono: '',
            lavori: [],
          };
        }
        const artigiano = merged[lavoro.artigiano_id];
        const existingIndex = artigiano.lavori.findIndex(item => String(item.id) === String(lavoro.id));
        if (existingIndex >= 0) artigiano.lavori[existingIndex] = { ...artigiano.lavori[existingIndex], ...lavoro };
        else artigiano.lavori.push(lavoro);
      }
    }

    if (schemas.recensioni.lavoroId && schemas.recensioni.artigianoId) {
      const [recensioniRows] = await pool.query('SELECT * FROM recensioni');
      applyRecensioniRows(merged, recensioniRows, schemas.recensioni);
    }

    for (const key of Object.keys(localArtigiani)) delete localArtigiani[key];
    for (const [id, artigiano] of Object.entries(merged)) {
      localArtigiani[id] = artigiano;
    }

    return { enabled: true, artisanCount: Object.keys(merged).length };
  }

  async function saveJob(artigiano, lavoro) {
    if (!(await ensureReady()) || !schemas.lavori.id || !schemas.lavori.artigianoId) return false;

    const payload = mapToTargetColumns(lavoro, {
      [schemas.lavori.id]: lavoro.id,
      [schemas.lavori.artigianoId]: artigiano.id,
      [schemas.lavori.titolo]: lavoro.titolo,
      [schemas.lavori.descrizione]: lavoro.descrizione,
      [schemas.lavori.citta]: lavoro.citta,
      [schemas.lavori.quartiere]: lavoro.quartiere,
      [schemas.lavori.sottocategoriaSlug]: lavoro.sottocategoria_slug,
      [schemas.lavori.sottocategoria]: lavoro.sottocategoria,
      [schemas.lavori.stelle]: lavoro.stelle,
      [schemas.lavori.visite]: lavoro.visite,
      [schemas.lavori.recensione]: lavoro.recensione,
      [schemas.lavori.cliente]: lavoro.cliente,
      [schemas.lavori.data]: lavoro.data,
      [schemas.lavori.dataRecensione]: lavoro.data_recensione,
      [schemas.lavori.immagini]: schemas.lavori.immagini ? JSON.stringify(lavoro.immagini || []) : undefined,
      [schemas.lavori.gps]: schemas.lavori.gps ? JSON.stringify(lavoro.gps || null) : undefined,
      [schemas.lavori.gpsLat]: lavoro.gps?.lat,
      [schemas.lavori.gpsLng]: lavoro.gps?.lng,
      [schemas.lavori.fotoGps]: schemas.lavori.fotoGps ? JSON.stringify(lavoro.foto_gps || []) : undefined,
      [schemas.lavori.gpsCheck]: schemas.lavori.gpsCheck ? JSON.stringify(lavoro.gps_check || null) : undefined,
    });

    if (!payload.columns.length) return false;

    const assignments = payload.columns
      .filter(column => column !== schemas.lavori.id)
      .map(column => `${column} = VALUES(${column})`);

    const sql = `INSERT INTO lavori (${payload.columns.join(', ')}) VALUES (${payload.columns.map(() => '?').join(', ')})`
      + (assignments.length ? ` ON DUPLICATE KEY UPDATE ${assignments.join(', ')}` : '');

    await pool.query(sql, payload.values);
    return true;
  }

  async function saveReview(artigiano, lavoro) {
    if (!(await ensureReady())) return false;

    if (schemas.lavori.id && schemas.lavori.artigianoId) {
      const fields = mapToTargetColumns(lavoro, {
        [schemas.lavori.recensione]: lavoro.recensione,
        [schemas.lavori.cliente]: lavoro.cliente,
        [schemas.lavori.stelle]: lavoro.stelle,
        [schemas.lavori.dataRecensione]: lavoro.data_recensione,
      });

      if (fields.columns.length) {
        const sql = `UPDATE lavori SET ${fields.columns.map(column => `${column} = ?`).join(', ')} WHERE ${schemas.lavori.id} = ? AND ${schemas.lavori.artigianoId} = ?`;
        await pool.query(sql, [...fields.values, lavoro.id, artigiano.id]);
      }
    }

    if (schemas.recensioni.lavoroId && schemas.recensioni.artigianoId) {
      const payload = mapToTargetColumns(lavoro, {
        [schemas.recensioni.artigianoId]: artigiano.id,
        [schemas.recensioni.lavoroId]: lavoro.id,
        [schemas.recensioni.cliente]: lavoro.cliente,
        [schemas.recensioni.recensione]: lavoro.recensione,
        [schemas.recensioni.stelle]: lavoro.stelle,
        [schemas.recensioni.data]: lavoro.data_recensione,
      });

      if (payload.columns.length) {
        const updateCols = payload.columns
          .filter(column => column !== schemas.recensioni.id)
          .map(column => `${column} = VALUES(${column})`);

        const sql = `INSERT INTO recensioni (${payload.columns.join(', ')}) VALUES (${payload.columns.map(() => '?').join(', ')})`
          + (updateCols.length ? ` ON DUPLICATE KEY UPDATE ${updateCols.join(', ')}` : '');

        await pool.query(sql, payload.values);
      }
    }

    if (schemas.artigiani.id) {
      const fields = mapToTargetColumns(artigiano, {
        [schemas.artigiani.stelle]: artigiano.stelle,
        [schemas.artigiani.recensioni]: artigiano.recensioni,
      });

      if (fields.columns.length) {
        const sql = `UPDATE artigiani SET ${fields.columns.map(column => `${column} = ?`).join(', ')} WHERE ${schemas.artigiani.id} = ?`;
        await pool.query(sql, [...fields.values, artigiano.id]);
      }
    }

    return true;
  }

  function getStatus() {
    return {
      enabled: !!(pool && schemas),
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
      },
      lastError: lastError ? lastError.message : null,
    };
  }

  return {
    enabled: true,
    syncData,
    saveJob,
    saveReview,
    getStatus,
  };
}

module.exports = {
  createMysqlStore,
};
