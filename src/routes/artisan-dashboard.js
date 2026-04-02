const express = require('express');
const {
  getArtisanDashboard,
  saveArtisanDashboardProfile,
  getJobCategoryOptions,
  getJobExamplesByCategory,
  saveNewDashboardJob,
  getDashboardJobEditor,
  updateDashboardJob,
} = require('../modules/dashboard/service');

function createArtisanDashboardRouter(appContext) {
  const router = express.Router();

  function getBaseUrl(req) {
    const configured = String(appContext.env.appBaseUrl || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
  }

  router.get('/dashboard/:slug/app.webmanifest', async (req, res, next) => {
    try {
      const dashboard = await getArtisanDashboard(appContext.dbPool, req.params.slug);
      if (!dashboard) {
        return res.status(404).json({ success: false, message: 'Dashboard non trovata.' });
      }

      res.type('application/manifest+json').send({
        name: `StelleVere ${dashboard.artigiano.nome}`,
        short_name: dashboard.artigiano.nome,
        start_url: `/dashboard/${dashboard.artigiano.slug}/lavori/nuovo`,
        scope: '/',
        display: 'standalone',
        background_color: '#f6f1e8',
        theme_color: '#bc5d08',
        icons: [
          { src: '/assets/pwa/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/assets/pwa/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Nuovo lavoro',
            short_name: 'Nuovo lavoro',
            url: `/dashboard/${dashboard.artigiano.slug}/lavori/nuovo`,
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            url: `/dashboard/${dashboard.artigiano.slug}`,
          },
        ],
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/dashboard/:slug', async (req, res, next) => {
    try {
      const dashboard = await getArtisanDashboard(appContext.dbPool, req.params.slug);
      if (!dashboard) {
        return res.status(404).render('public/not-found', {
          title: 'Dashboard non trovata',
          message: 'Non esiste ancora una dashboard per questa attività.',
        });
      }
      res.render('dashboard/index', {
        ...dashboard,
        saved: req.query.saved === '1',
        jobSaved: req.query.jobSaved === '1',
        appBaseUrl: appContext.env.appBaseUrl || '',
        publicBaseUrl: getBaseUrl(req),
        manifestUrl: `/dashboard/${dashboard.artigiano.slug}/app.webmanifest`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/dashboard/:slug/lavori/nuovo', async (req, res, next) => {
    try {
      const dashboard = await getArtisanDashboard(appContext.dbPool, req.params.slug);
      if (!dashboard) {
        return res.status(404).render('public/not-found', {
          title: 'Dashboard non trovata',
          message: 'Non esiste ancora una dashboard per questa attività.',
        });
      }
      res.render('dashboard/new-job', {
        ...dashboard,
        categories: getJobCategoryOptions(),
        examplesByCategory: getJobExamplesByCategory(),
        saved: req.query.saved === '1',
        error: '',
        upgradeRequired: false,
        isEditMode: false,
        editJobSlug: '',
        values: {
          titolo: '',
          descrizione: '',
          citta: dashboard.artigiano.citta_principale || '',
          quartiere: '',
          cliente_whatsapp: '',
          categoria_slug: dashboard.artigiano.categoria_slug || '',
          lat: '',
          lng: '',
          immagini_json: '[]',
        },
        manifestUrl: `/dashboard/${dashboard.artigiano.slug}/app.webmanifest`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/dashboard/:slug/lavori/nuovo', async (req, res, next) => {
    try {
      const result = await saveNewDashboardJob(appContext.dbPool, req.params.slug, req.body);
      if (!result.dashboard) {
        return res.status(404).render('public/not-found', {
          title: 'Dashboard non trovata',
          message: 'Non esiste ancora una dashboard per questa attività.',
        });
      }

      if (!result.ok) {
        return res.status(400).render('dashboard/new-job', {
          ...result.dashboard,
          categories: getJobCategoryOptions(),
          examplesByCategory: getJobExamplesByCategory(),
          saved: false,
          error: result.error,
          upgradeRequired: Boolean(result.upgradeRequired),
          isEditMode: false,
          editJobSlug: '',
          values: {
            titolo: req.body.titolo || '',
            descrizione: req.body.descrizione || '',
            citta: req.body.citta || '',
            quartiere: req.body.quartiere || '',
            cliente_whatsapp: req.body.cliente_whatsapp || '',
            categoria_slug: req.body.categoria_slug || '',
            lat: req.body.lat || '',
            lng: req.body.lng || '',
            immagini_json: req.body.immagini_json || '[]',
          },
          manifestUrl: `/dashboard/${result.dashboard.artigiano.slug}/app.webmanifest`,
        });
      }

      res.redirect(`/dashboard/${req.params.slug}?jobSaved=1`);
    } catch (error) {
      next(error);
    }
  });

  router.get('/dashboard/:slug/lavori/:jobSlug/modifica', async (req, res, next) => {
    try {
      const editor = await getDashboardJobEditor(appContext.dbPool, req.params.slug, req.params.jobSlug);
      if (!editor) {
        return res.status(404).render('public/not-found', {
          title: 'Lavoro non trovato',
          message: 'Non esiste ancora un lavoro modificabile per questa attività.',
        });
      }
      res.render('dashboard/new-job', {
        ...editor.dashboard,
        categories: getJobCategoryOptions(),
        examplesByCategory: getJobExamplesByCategory(),
        saved: false,
        error: '',
        upgradeRequired: false,
        isEditMode: true,
        editJobSlug: req.params.jobSlug,
        values: {
          titolo: editor.lavoro.titolo || '',
          descrizione: editor.lavoro.descrizione || '',
          citta: editor.lavoro.citta || editor.dashboard.artigiano.citta_principale || '',
          quartiere: editor.lavoro.quartiere || '',
          cliente_whatsapp: editor.lavoro.cliente_whatsapp || '',
          categoria_slug: editor.lavoro.categoria_slug || editor.dashboard.artigiano.categoria_slug || '',
          lat: editor.lavoro.lat || '',
          lng: editor.lavoro.lng || '',
          immagini_json: JSON.stringify(editor.lavoro.immagini || []),
        },
        manifestUrl: `/dashboard/${editor.dashboard.artigiano.slug}/app.webmanifest`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/dashboard/:slug/lavori/:jobSlug/modifica', async (req, res, next) => {
    try {
      const result = await updateDashboardJob(appContext.dbPool, req.params.slug, req.params.jobSlug, req.body);
      if (!result.dashboard) {
        return res.status(404).render('public/not-found', {
          title: 'Dashboard non trovata',
          message: 'Non esiste ancora una dashboard per questa attività.',
        });
      }

      if (!result.ok) {
        return res.status(400).render('dashboard/new-job', {
          ...result.dashboard,
          categories: getJobCategoryOptions(),
          examplesByCategory: getJobExamplesByCategory(),
          saved: false,
          error: result.error,
          upgradeRequired: false,
          isEditMode: true,
          editJobSlug: req.params.jobSlug,
          values: {
            titolo: req.body.titolo || '',
            descrizione: req.body.descrizione || '',
            citta: req.body.citta || '',
            quartiere: req.body.quartiere || '',
            cliente_whatsapp: req.body.cliente_whatsapp || '',
            categoria_slug: req.body.categoria_slug || '',
            lat: req.body.lat || '',
            lng: req.body.lng || '',
            immagini_json: req.body.immagini_json || '[]',
          },
          manifestUrl: `/dashboard/${result.dashboard.artigiano.slug}/app.webmanifest`,
        });
      }

      res.redirect(`/dashboard/${req.params.slug}?saved=1`);
    } catch (error) {
      next(error);
    }
  });

  router.post('/dashboard/:slug/profilo', async (req, res, next) => {
    try {
      const dashboard = await saveArtisanDashboardProfile(appContext.dbPool, req.params.slug, req.body);
      if (!dashboard) {
        return res.status(404).render('public/not-found', {
          title: 'Dashboard non trovata',
          message: 'Non esiste ancora una dashboard per questa attività.',
        });
      }
      res.redirect(`/dashboard/${req.params.slug}?saved=1`);
    } catch (error) {
      next(error);
    }
  });

  router.get('/dashboard/:slug/piani', async (req, res, next) => {
    try {
      const dashboard = await getArtisanDashboard(appContext.dbPool, req.params.slug);
      if (!dashboard) {
        return res.status(404).render('public/not-found', {
          title: 'Dashboard non trovata',
          message: 'Non esiste ancora una dashboard per questa attività.',
        });
      }
      res.render('dashboard/plans', dashboard);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createArtisanDashboardRouter,
};
