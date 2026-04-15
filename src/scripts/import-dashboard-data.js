const { getEnv } = require('../config/env');
const { createDbPool } = require('../config/db');
const { buildDashboardProfile } = require('../data/dashboard-store');
const { listAllLocalDashboardJobs } = require('../data/dashboard-jobs-store');
const { listLegacyArtigiani } = require('../data/legacy-store');
const { detectPhoneType } = require('../services/phone-service');
const { createLavoro, updateLavoro, findLavoroByArtigianoAndSlug } = require('../repositories/lavori-repo');

async function loadCategoryMap(pool) {
  const [rows] = await pool.query('SELECT id, slug FROM categorie');
  return rows.reduce((acc, row) => {
    acc[row.slug] = row.id;
    return acc;
  }, {});
}

async function upsertArtigiano(pool, profile, categoryMap) {
  const artigiano = profile.artigiano;
  const categoriaSlug = String(artigiano.categoria_slug || 'idraulica').trim().toLowerCase();
  const categoriaId = categoryMap[categoriaSlug] || categoryMap.idraulica;

  if (!categoriaId) {
    throw new Error(`Categoria non trovata per ${artigiano.slug}: ${categoriaSlug}`);
  }

  const source = artigiano.claim_status === 'claimed' ? 'claim' : 'google_maps';
  const websiteEnabled = artigiano.website_enabled ? 1 : 0;
  const [result] = await pool.query(`
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
      sede_legale,
      orari_lavoro,
      bio,
      sito_web,
      facebook_url,
      instagram_url,
      tiktok_url,
      claim_status,
      otp_channel,
      website_enabled,
      rating_avg,
      reviews_count,
      jobs_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      nome = VALUES(nome),
      ragione_sociale = VALUES(ragione_sociale),
      source = VALUES(source),
      telefono = VALUES(telefono),
      telefono_tipo = VALUES(telefono_tipo),
      categoria_principale_id = VALUES(categoria_principale_id),
      citta_principale = VALUES(citta_principale),
      quartiere_principale = VALUES(quartiere_principale),
      sede_legale = VALUES(sede_legale),
      orari_lavoro = VALUES(orari_lavoro),
      bio = VALUES(bio),
      sito_web = VALUES(sito_web),
      facebook_url = VALUES(facebook_url),
      instagram_url = VALUES(instagram_url),
      tiktok_url = VALUES(tiktok_url),
      claim_status = VALUES(claim_status),
      otp_channel = VALUES(otp_channel),
      website_enabled = VALUES(website_enabled),
      updated_at = CURRENT_TIMESTAMP
  `, [
    artigiano.slug,
    artigiano.nome,
    artigiano.nome,
    source,
    artigiano.telefono || '',
    detectPhoneType(artigiano.telefono || ''),
    categoriaId,
    artigiano.citta_principale || '',
    artigiano.quartiere_principale || '',
    artigiano.sede_legale || '',
    JSON.stringify(artigiano.hours || []),
    artigiano.descrizione_attivita || artigiano.bio || '',
    artigiano.website_url || '',
    artigiano.facebook_url || '',
    artigiano.instagram_url || '',
    artigiano.tiktok_url || '',
    ['unclaimed', 'pending', 'claimed', 'blocked'].includes(artigiano.claim_status) ? artigiano.claim_status : 'unclaimed',
    detectPhoneType(artigiano.telefono || '') === 'landline' ? 'voice' : 'sms',
    websiteEnabled,
    Number(artigiano.rating_avg || 0),
    Number(artigiano.reviews_count || 0),
    Number((profile.lavori || []).filter((job) => !job.is_example).length || 0),
  ]);

  if (result.insertId) return result.insertId;

  const [rows] = await pool.query('SELECT id FROM artigiani WHERE slug = ? LIMIT 1', [artigiano.slug]);
  return rows[0] ? rows[0].id : null;
}

async function syncJobReviews(pool, lavoroId, artigianoId, recensioni) {
  await pool.query('DELETE FROM recensioni WHERE lavoro_id = ?', [lavoroId]);

  const validReviews = Array.isArray(recensioni) ? recensioni.filter((item) => String(item.testo || '').trim() || Number(item.voto || 0) > 0) : [];

  for (const review of validReviews) {
    await pool.query(`
      INSERT INTO recensioni (
        lavoro_id,
        artigiano_id,
        cliente_nome,
        voto,
        testo,
        stato,
        data_recensione
      ) VALUES (?, ?, ?, ?, ?, 'published', ?)
    `, [
      lavoroId,
      artigianoId,
      String(review.cliente_nome || 'Cliente').trim() || 'Cliente',
      Number(review.voto || 5),
      String(review.testo || '').trim(),
      review.data_recensione ? new Date(review.data_recensione) : new Date(),
    ]);
  }

  const reviewsCount = validReviews.length;
  const ratingAvg = reviewsCount
    ? Number((validReviews.reduce((sum, review) => sum + Number(review.voto || 0), 0) / reviewsCount).toFixed(2))
    : 0;

  await pool.query(`
    UPDATE lavori
    SET reviews_count = ?, rating_avg = ?
    WHERE id = ?
  `, [reviewsCount, ratingAvg, lavoroId]);
}

async function refreshArtigianoStats(pool, artigianoId) {
  const [[stats]] = await pool.query(`
    SELECT
      COUNT(*) AS jobsCount,
      COALESCE(SUM(reviews_count), 0) AS reviewsCount,
      COALESCE(AVG(NULLIF(rating_avg, 0)), 0) AS avgRating
    FROM lavori
    WHERE artigiano_id = ?
      AND stato_pubblicazione = 'published'
  `, [artigianoId]);

  await pool.query(`
    UPDATE artigiani
    SET jobs_count = ?, reviews_count = ?, rating_avg = ?
    WHERE id = ?
  `, [
    Number(stats.jobsCount || 0),
    Number(stats.reviewsCount || 0),
    Number(Number(stats.avgRating || 0).toFixed(2)),
    artigianoId,
  ]);
}

function buildJobPayload(artigianoId, artigianoSlug, job) {
  return {
    artigianoId,
    artigianoSlug,
    lavoroSlug: job.slug,
    slugOverride: job.slug,
    categoriaSlug: String(job.categoria_slug || 'idraulica').trim().toLowerCase(),
    tipoNome: String(job.tipo_nome || job.titolo || 'Intervento').trim(),
    titolo: String(job.titolo || '').trim(),
    descrizione: String(job.descrizione || '').trim(),
    citta: String(job.citta || '').trim(),
    quartiere: String(job.quartiere || '').trim(),
    indirizzoTestuale: [String(job.quartiere || '').trim(), String(job.citta || '').trim()].filter(Boolean).join(', '),
    lat: Number.isFinite(Number(job.lat)) ? Number(job.lat) : 0,
    lng: Number.isFinite(Number(job.lng)) ? Number(job.lng) : 0,
    immagini: Array.isArray(job.immagini) ? job.immagini : [],
  };
}

async function syncDashboardData() {
  const env = getEnv();
  const pool = createDbPool(env.db);
  if (!pool) {
    throw new Error('Config database mancante: compila prima il file .env');
  }

  const categoryMap = await loadCategoryMap(pool);
  const jobEntries = listAllLocalDashboardJobs();
  const involvedSlugs = Array.from(new Set(jobEntries.map((job) => job.artigiano_slug)));

  if (!involvedSlugs.length) {
    console.log('Nessun lavoro locale da sincronizzare.');
    await pool.end();
    return;
  }

  let syncedProfiles = 0;
  let syncedJobs = 0;

  for (const slug of involvedSlugs) {
    const profile = buildDashboardProfile(slug);
    if (!profile) {
      console.warn(`Profilo non trovato per slug ${slug}, salto.`);
      continue;
    }

    const artigianoId = await upsertArtigiano(pool, profile, categoryMap);
    if (!artigianoId) {
      console.warn(`Artigiano non sincronizzato per slug ${slug}, salto.`);
      continue;
    }
    syncedProfiles += 1;

    const jobs = jobEntries.filter((job) => job.artigiano_slug === slug);
    for (const job of jobs) {
      const payload = buildJobPayload(artigianoId, slug, job);
      const existing = await findLavoroByArtigianoAndSlug(pool, slug, job.slug);
      const saved = existing
        ? await updateLavoro(pool, payload)
        : await createLavoro(pool, payload);

      if (!saved) {
        console.warn(`Lavoro non sincronizzato: ${slug}/${job.slug}`);
        continue;
      }

      const current = await findLavoroByArtigianoAndSlug(pool, slug, existing ? job.slug : saved.slug);
      if (current) {
        await syncJobReviews(pool, current.id, artigianoId, job.recensioni || []);
      }
      syncedJobs += 1;
    }

    await refreshArtigianoStats(pool, artigianoId);
  }

  const localArtigiani = listLegacyArtigiani();
  console.log(`Profili dashboard sincronizzati: ${syncedProfiles}`);
  console.log(`Lavori dashboard sincronizzati: ${syncedJobs}`);
  console.log(`Artigiani legacy disponibili localmente: ${localArtigiani.length}`);
  await pool.end();
}

syncDashboardData().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
