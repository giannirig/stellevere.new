const express = require('express');
const { startClaim } = require('../modules/claims/service');
const { getDirectoryOverview, getPublicArtisanProfile } = require('../modules/artigiani/service');
const {
  listWorksForSeo,
  resolveSearchIntent,
  scoreWorkAgainstIntent,
  scoreTextAgainstIntent,
  buildPublicWorkPath,
} = require('../modules/lavori/service');
const { getLatestReviews } = require('../modules/recensioni/service');
const { saveNewDashboardJob, getArtisanDashboard } = require('../modules/dashboard/service');
const { submitWorkReview } = require('../modules/recensioni/service');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeSlug(value) {
  return normalizeText(value).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

function clampLimit(value, fallback = 20, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function paginate(items, page, perPage) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    meta: {
      page: safePage,
      per_page: perPage,
      total,
      total_pages: totalPages,
    },
  };
}

function createApiRouter(appContext) {
  const router = express.Router();

  function getBaseUrl(req) {
    const configured = String(appContext.env.appBaseUrl || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
  }

  function readApiKey(req) {
    return String(req.get('x-api-key') || req.query.api_key || req.body.api_key || '').trim();
  }

  function requireWriteKey(req, res, next) {
    const configured = String(appContext.env.api && appContext.env.api.writeKey || '').trim();
    if (!configured && appContext.env.nodeEnv !== 'production') return next();
    if (readApiKey(req) !== configured) {
      return res.status(401).json({ success: false, message: 'API key non valida.' });
    }
    return next();
  }

  function requireAdminKey(req, res, next) {
    const configured = String(appContext.env.api && appContext.env.api.adminKey || '').trim();
    if (!configured && appContext.env.nodeEnv !== 'production') return next();
    if (readApiKey(req) !== configured) {
      return res.status(401).json({ success: false, message: 'API admin key non valida.' });
    }
    return next();
  }

  router.get('/api/docs', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.render('public/api-docs', {
      baseUrl,
      writeKeyConfigured: Boolean(appContext.env.api && appContext.env.api.writeKey),
      adminKeyConfigured: Boolean(appContext.env.api && appContext.env.api.adminKey),
      endpoints: [
        { method: 'GET', path: '/api/artigiani', description: 'Lista artigiani con filtri e paginazione.' },
        { method: 'GET', path: '/api/artigiani/:slug', description: 'Dettaglio artigiano con lavori pubblicati.' },
        { method: 'GET', path: '/api/lavori', description: 'Lista lavori con ricerca semantica, filtri e paginazione.' },
        { method: 'GET', path: '/api/lavori/:artigianoSlug/:lavoroSlug', description: 'Dettaglio di un lavoro specifico.' },
        { method: 'GET', path: '/api/recensioni', description: 'Lista recensioni pubblicate più recenti.' },
        { method: 'POST', path: '/api/lavori', description: 'Crea un nuovo lavoro via API. Richiede API key.' },
        { method: 'POST', path: '/api/recensioni', description: 'Crea una recensione su un lavoro. Richiede API key.' },
        { method: 'POST', path: '/api/claims', description: 'Avvia un claim attività.' },
        { method: 'GET', path: '/api/admin/overview', description: 'Dati aggregati admin. Richiede API admin key.' },
      ],
    });
  });

  router.get('/api/artigiani', async (req, res, next) => {
    try {
      const allArtigiani = await getDirectoryOverview(appContext.dbPool);
      const q = normalizeText(req.query.q);
      const categoria = normalizeSlug(req.query.categoria);
      const citta = normalizeText(req.query.citta);
      const quartiere = normalizeText(req.query.quartiere);
      const page = clampLimit(req.query.page, 1, 10000);
      const perPage = clampLimit(req.query.per_page || req.query.limit, 24, 100);
      const intent = resolveSearchIntent(req.query.q || '');

      const rankedItems = allArtigiani
        .map((artigiano) => {
          const descriptionText = [
            artigiano.descrizione_attivita,
            artigiano.bio,
          ].filter(Boolean).join(' ');

          const haystack = [
            artigiano.nome,
            artigiano.categoria_nome,
            artigiano.categoria_slug,
            artigiano.citta_principale,
            artigiano.quartiere_principale,
            descriptionText,
          ].filter(Boolean).join(' ');

          let score = q ? scoreTextAgainstIntent(haystack, intent) : 0;
          score += q ? scoreTextAgainstIntent(descriptionText, intent) * 1.5 : 0;
          if (intent.inferredCategorySlug) {
            const categoryText = normalizeSlug(artigiano.categoria_slug || artigiano.categoria_nome);
            if (categoryText === normalizeSlug(intent.inferredCategorySlug)) score += 10;
          }
          score += Math.min(Number(artigiano.rating_avg || 0), 5);
          score += Math.min(Number(artigiano.reviews_count || 0), 10) * 0.2;

          return { artigiano, score };
        })
        .filter(({ artigiano, score }) => {
          const categoryMatch = !categoria || normalizeSlug(artigiano.categoria_slug || artigiano.categoria_nome) === categoria;
          const cityMatch = !citta || normalizeText(artigiano.citta_principale).includes(citta);
          const quartiereMatch = !quartiere || normalizeText(artigiano.quartiere_principale).includes(quartiere);
          const textMatch = !q || score > 0;
          return categoryMatch && cityMatch && quartiereMatch && textMatch;
        })
        .sort((a, b) => b.score - a.score)
        .map(({ artigiano }) => ({
          slug: artigiano.slug,
          nome: artigiano.nome,
          telefono: artigiano.telefono,
          categoria: {
            slug: artigiano.categoria_slug,
            nome: artigiano.categoria_nome,
          },
          citta: artigiano.citta_principale || '',
          quartiere: artigiano.quartiere_principale || '',
          indirizzo: artigiano.indirizzo_completo || '',
          rating_avg: Number(artigiano.rating_avg || 0),
          reviews_count: Number(artigiano.reviews_count || 0),
          jobs_count: Number(artigiano.jobs_count || 0),
          profile_url: `/artigiano/${artigiano.slug}`,
        }));

      const paged = paginate(rankedItems, page, perPage);

      res.json({
        success: true,
        count: paged.items.length,
        filters: {
          q: req.query.q || '',
          categoria: req.query.categoria || '',
          citta: req.query.citta || '',
          quartiere: req.query.quartiere || '',
        },
        meta: paged.meta,
        items: paged.items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/artigiani/:slug', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Artigiano non trovato.' });
      }

      res.json({
        success: true,
        artigiano: {
          slug: profile.artigiano.slug,
          nome: profile.artigiano.nome,
          telefono: profile.artigiano.telefono,
          categoria: {
            slug: profile.artigiano.categoria_slug,
            nome: profile.artigiano.categoria_nome,
          },
          citta: profile.artigiano.citta_principale || '',
          quartiere: profile.artigiano.quartiere_principale || '',
          indirizzo: profile.artigiano.indirizzo_completo || '',
          rating_avg: Number(profile.artigiano.rating_avg || 0),
          reviews_count: Number(profile.artigiano.reviews_count || 0),
          jobs_count: Number(profile.lavori.length || 0),
          descrizione_attivita: profile.artigiano.descrizione_attivita || '',
          profile_url: `/artigiano/${profile.artigiano.slug}`,
        },
        lavori: profile.lavori.map((lavoro) => ({
          slug: lavoro.slug,
          titolo: lavoro.titolo,
          descrizione: lavoro.descrizione,
          citta: lavoro.citta || '',
          quartiere: lavoro.quartiere || '',
          rating_avg: Number(lavoro.rating_avg || 0),
          reviews_count: Number(lavoro.reviews_count || 0),
          detail_url: lavoro.detail_path || '',
          cover_path: lavoro.cover_path || '',
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/artigiani/:slug/lavori-feed', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Artigiano non trovato.' });
      }

      const planLimits = {
        free: 5,
        base: 10,
        pro: 25,
        unlimited: null,
      };
      const planSlug = String((profile.artigiano.public_plan && profile.artigiano.public_plan.slug) || 'free').toLowerCase();
      const requestedLimit = clampLimit(req.query.per_page || req.query.limit, 6, 25);
      const allowedLimit = Object.prototype.hasOwnProperty.call(planLimits, planSlug) ? planLimits[planSlug] : 5;
      const finalLimit = allowedLimit === null ? requestedLimit : Math.min(requestedLimit, allowedLimit);

      const items = profile.lavori.slice(0, finalLimit).map((lavoro) => ({
        slug: lavoro.slug,
        titolo: lavoro.titolo,
        descrizione: lavoro.descrizione,
        citta: lavoro.citta || '',
        quartiere: lavoro.quartiere || '',
        location_text: [
          lavoro.citta ? `a ${lavoro.citta}` : '',
          lavoro.quartiere ? `in zona ${lavoro.quartiere}` : '',
        ].filter(Boolean).join(' '),
        rating_avg: Number(lavoro.rating_avg || 0),
        reviews_count: Number(lavoro.reviews_count || 0),
        cover_path: lavoro.cover_path || '',
        detail_url: lavoro.detail_path || '',
      }));

      res.json({
        success: true,
        artigiano: {
          slug: profile.artigiano.slug,
          nome: profile.artigiano.nome,
          categoria: profile.artigiano.categoria_nome,
          citta: profile.artigiano.citta_principale || '',
        },
        count: items.length,
        limit: finalLimit,
        items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/lavori', async (req, res, next) => {
    try {
      const allWorks = await listWorksForSeo(appContext.dbPool);
      const q = String(req.query.q || '').trim();
      const categoria = normalizeSlug(req.query.categoria);
      const citta = normalizeSlug(req.query.citta);
      const quartiere = normalizeSlug(req.query.quartiere);
      const artigiano = normalizeSlug(req.query.artigiano);
      const page = clampLimit(req.query.page, 1, 10000);
      const perPage = clampLimit(req.query.per_page || req.query.limit, 24, 100);
      const intent = resolveSearchIntent(q);

      const rankedItems = allWorks
        .map((lavoro) => ({ lavoro, score: q ? scoreWorkAgainstIntent(lavoro, intent) : 0 }))
        .filter(({ lavoro, score }) => {
          const categoryMatch = !categoria || normalizeSlug(lavoro.categoria_slug || lavoro.categoria_nome) === categoria;
          const cityMatch = !citta || normalizeSlug(lavoro.citta) === citta;
          const quartiereMatch = !quartiere || normalizeSlug(lavoro.quartiere) === quartiere;
          const artigianoMatch = !artigiano || normalizeSlug(lavoro.artigiano_slug) === artigiano;
          const textMatch = !q || score > 0;
          return categoryMatch && cityMatch && quartiereMatch && artigianoMatch && textMatch;
        })
        .sort((a, b) => b.score - a.score)
        .map(({ lavoro }) => ({
          slug: lavoro.slug,
          titolo: lavoro.titolo,
          descrizione: lavoro.descrizione || '',
          categoria: {
            slug: lavoro.categoria_slug,
            nome: lavoro.categoria_nome,
          },
          tipo: {
            slug: lavoro.tipo_slug || '',
            nome: lavoro.tipo_nome || '',
          },
          citta: lavoro.citta || '',
          quartiere: lavoro.quartiere || '',
          artigiano: {
            slug: lavoro.artigiano_slug,
            nome: lavoro.artigiano_nome,
            profile_url: `/artigiano/${lavoro.artigiano_slug}`,
          },
          rating_avg: Number(lavoro.rating_avg || 0),
          reviews_count: Number(lavoro.reviews_count || 0),
          cover_path: lavoro.cover_path || '',
          detail_url: buildPublicWorkPath(lavoro),
        }));

      const paged = paginate(rankedItems, page, perPage);

      res.json({
        success: true,
        count: paged.items.length,
        filters: {
          q,
          categoria: req.query.categoria || '',
          citta: req.query.citta || '',
          quartiere: req.query.quartiere || '',
          artigiano: req.query.artigiano || '',
        },
        meta: paged.meta,
        items: paged.items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/lavori/:artigianoSlug/:lavoroSlug', async (req, res, next) => {
    try {
      const allWorks = await listWorksForSeo(appContext.dbPool);
      const lavoro = allWorks.find((item) =>
        normalizeSlug(item.artigiano_slug) === normalizeSlug(req.params.artigianoSlug) &&
        normalizeSlug(item.slug) === normalizeSlug(req.params.lavoroSlug)
      );

      if (!lavoro) {
        return res.status(404).json({ success: false, message: 'Lavoro non trovato.' });
      }

      res.json({
        success: true,
        lavoro: {
          slug: lavoro.slug,
          titolo: lavoro.titolo,
          descrizione: lavoro.descrizione || '',
          categoria: {
            slug: lavoro.categoria_slug,
            nome: lavoro.categoria_nome,
          },
          tipo: {
            slug: lavoro.tipo_slug || '',
            nome: lavoro.tipo_nome || '',
          },
          citta: lavoro.citta || '',
          quartiere: lavoro.quartiere || '',
          lat: Number(lavoro.lat || 0) || null,
          lng: Number(lavoro.lng || 0) || null,
          rating_avg: Number(lavoro.rating_avg || 0),
          reviews_count: Number(lavoro.reviews_count || 0),
          artigiano: {
            slug: lavoro.artigiano_slug,
            nome: lavoro.artigiano_nome,
            profile_url: `/artigiano/${lavoro.artigiano_slug}`,
          },
          cover_path: lavoro.cover_path || '',
          detail_url: buildPublicWorkPath(lavoro),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/recensioni', async (req, res, next) => {
    try {
      const page = clampLimit(req.query.page, 1, 10000);
      const perPage = clampLimit(req.query.per_page || req.query.limit, 20, 100);
      const recensioni = await getLatestReviews(appContext.dbPool);
      const normalized = recensioni
        .map((recensione) => ({
          id: recensione.id,
          cliente_nome: recensione.cliente_nome,
          voto: Number(recensione.voto || 0),
          testo: recensione.testo,
          data_recensione: recensione.data_recensione,
          titolo_lavoro: recensione.titolo || '',
        }));

      const paged = paginate(normalized, page, perPage);

      res.json({
        success: true,
        count: paged.items.length,
        meta: paged.meta,
        items: paged.items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/lavori', requireWriteKey, async (req, res, next) => {
    try {
      const artigianoSlug = String(req.body.artigiano_slug || '').trim();
      if (!artigianoSlug) {
        return res.status(400).json({ success: false, message: 'artigiano_slug mancante.' });
      }

      const immagini = Array.isArray(req.body.immagini) ? req.body.immagini : [];
      const payload = {
        titolo: req.body.titolo || '',
        descrizione: req.body.descrizione || '',
        citta: req.body.citta || '',
        quartiere: req.body.quartiere || '',
        cliente_whatsapp: req.body.cliente_whatsapp || '',
        categoria_slug: req.body.categoria_slug || '',
        lat: req.body.lat,
        lng: req.body.lng,
        immagini_json: JSON.stringify(immagini),
      };

      const result = await saveNewDashboardJob(appContext.dbPool, artigianoSlug, payload);
      if (!result.ok) {
        return res.status(result.upgradeRequired ? 402 : 400).json({
          success: false,
          message: result.error,
          upgrade_required: Boolean(result.upgradeRequired),
        });
      }

      const dashboard = result.dashboard || await getArtisanDashboard(appContext.dbPool, artigianoSlug);
      const latestJob = dashboard && Array.isArray(dashboard.lavori) ? dashboard.lavori[0] : null;
      return res.status(201).json({
        success: true,
        lavoro: latestJob ? {
          slug: latestJob.slug,
          titolo: latestJob.titolo,
          detail_url: latestJob.detail_path || '',
        } : null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/recensioni', requireWriteKey, async (req, res, next) => {
    try {
      const artigianoSlug = String(req.body.artigiano_slug || '').trim();
      const lavoroSlug = String(req.body.lavoro_slug || '').trim();
      if (!artigianoSlug || !lavoroSlug) {
        return res.status(400).json({ success: false, message: 'artigiano_slug e lavoro_slug sono obbligatori.' });
      }

      const result = await submitWorkReview(appContext.dbPool, artigianoSlug, lavoroSlug, {
        cliente_nome: req.body.cliente_nome,
        voto: req.body.voto,
        testo: req.body.testo,
      });

      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message });
      }

      return res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/admin/overview', requireAdminKey, async (req, res, next) => {
    try {
      const [artigiani, lavori, recensioni] = await Promise.all([
        getDirectoryOverview(appContext.dbPool),
        listWorksForSeo(appContext.dbPool),
        getLatestReviews(appContext.dbPool),
      ]);

      res.json({
        success: true,
        totals: {
          artigiani: artigiani.length,
          lavori: lavori.length,
          recensioni: recensioni.length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/claims', async (req, res, next) => {
    try {
      const claimId = await startClaim(appContext.dbPool, {
        artigianoId: req.body.artigiano_id,
        telefonoVerificato: req.body.telefono,
        metodoClaim: req.body.metodo || 'sms',
      });

      res.status(201).json({
        success: true,
        claimId,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createApiRouter,
};
