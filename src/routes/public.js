const express = require('express');
const { getDirectoryOverview } = require('../modules/artigiani/service');
const { getPublicArtisanProfile, getCategoryDirectoryPage } = require('../modules/artigiani/service');
const { getLatestWorks, searchSimilarWorks, resolveSearchIntent, scoreTextAgainstIntent, getSeoWorksPage, getCategoryWorksDirectory, getSeoWorkDetail, getWorkDetailByPublicPath, getWorkDetailBySlug, buildPublicWorkPath } = require('../modules/lavori/service');
const { getLatestReviews, getReviewTarget, submitWorkReview, getReviewsForWork } = require('../modules/recensioni/service');
const { initiateClaim, getPendingClaim, verifyClaimCode } = require('../modules/claims/service');
const { createProfileRequest, confirmProfileRequest, findProfileRequestByToken } = require('../data/new-profile-requests-store');
const { buildAddressString, buildHoursFromPayload } = require('../data/dashboard-store');

function createPublicRouter(appContext) {
  const router = express.Router();
  const reservedRoots = new Set(['dashboard', 'admin', 'api', 'claim', 'recensione', 'artigiano', 'health']);
  const cityCoordinates = {
    alessandria: { lat: 44.9128, lng: 8.6157 },
    ancona: { lat: 43.6158, lng: 13.5189 },
    bergamo: { lat: 45.6983, lng: 9.6773 },
    brescia: { lat: 45.5416, lng: 10.2118 },
    como: { lat: 45.8081, lng: 9.0852 },
    roma: { lat: 41.9028, lng: 12.4964 },
    milano: { lat: 45.4642, lng: 9.19 },
    torino: { lat: 45.0703, lng: 7.6869 },
    napoli: { lat: 40.8518, lng: 14.2681 },
    bologna: { lat: 44.4949, lng: 11.3426 },
    firenze: { lat: 43.7696, lng: 11.2558 },
    livorno: { lat: 43.5485, lng: 10.3106 },
    rimini: { lat: 44.0678, lng: 12.5695 },
    modena: { lat: 44.6471, lng: 10.9252 },
    monza: { lat: 45.5845, lng: 9.2744 },
    novara: { lat: 45.445, lng: 8.6218 },
    parma: { lat: 44.8015, lng: 10.3279 },
    perugia: { lat: 43.1107, lng: 12.3908 },
    pisa: { lat: 43.7169, lng: 10.3966 },
    'reggio emilia': { lat: 44.6983, lng: 10.6312 },
    treviso: { lat: 45.6669, lng: 12.243 },
    lucca: { lat: 43.8429, lng: 10.5027 },
    varese: { lat: 45.8206, lng: 8.825 },
    genova: { lat: 44.4056, lng: 8.9463 },
    verona: { lat: 45.4384, lng: 10.9916 },
    vicenza: { lat: 45.5455, lng: 11.5354 },
    bari: { lat: 41.1171, lng: 16.8719 },
    padova: { lat: 45.4064, lng: 11.8768 },
  };

  function getPlanPriority(artigiano) {
    const slug = String((artigiano.public_plan && artigiano.public_plan.slug) || artigiano.plan_slug || '').toLowerCase();
    if (slug === 'unlimited') return 4;
    if (slug === 'pro') return 3;
    if (slug === 'base') return 2;
    return 0;
  }

  function buildFeaturedArtigianiPool(artigiani, intent, cityFilter) {
    return artigiani
      .map((artigiano) => {
        const cityKey = String(artigiano.citta_principale || '').toLowerCase();
        const coords = cityCoordinates[cityKey] || null;
        const haystack = [
          artigiano.nome,
          artigiano.categoria_nome,
          artigiano.categoria_slug,
          artigiano.descrizione_attivita,
          artigiano.bio,
        ].filter(Boolean).join(' ');

        let searchScore = 0;
        if (intent && intent.normalizedQuery) {
          searchScore += scoreTextAgainstIntent(haystack, intent);
        }
        if (cityFilter && cityKey.includes(cityFilter)) {
          searchScore += 8;
        }

        return {
          ...artigiano,
          map_lat: coords ? coords.lat : null,
          map_lng: coords ? coords.lng : null,
          plan_priority: getPlanPriority(artigiano),
          search_score: searchScore,
        };
      })
      .sort((a, b) => {
        if (b.plan_priority !== a.plan_priority) return b.plan_priority - a.plan_priority;
        if (b.search_score !== a.search_score) return b.search_score - a.search_score;
        if (Number(b.rating_avg || 0) !== Number(a.rating_avg || 0)) return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
        if (Number(b.reviews_count || 0) !== Number(a.reviews_count || 0)) return Number(b.reviews_count || 0) - Number(a.reviews_count || 0);
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'it');
      });
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function scoreArtigianoMatch(artigiano, probe) {
    const name = normalizeText(artigiano.nome);
    const city = normalizeText(artigiano.citta_principale);
    const phone = normalizeText(artigiano.telefono).replace(/\D/g, '');
    const probeName = normalizeText(probe.nome_attivita || probe.q);
    const probeCity = normalizeText(probe.citta);
    const probePhone = normalizeText(probe.telefono).replace(/\D/g, '');

    let score = 0;
    if (probeName && name.includes(probeName)) score += 8;
    if (probeName && probeName.includes(name)) score += 5;
    if (probeCity && city && probeCity === city) score += 4;
    if (probePhone && phone && (phone.includes(probePhone) || probePhone.includes(phone))) score += 10;

    const probeTokens = probeName.split(/\s+/).filter(Boolean);
    score += probeTokens.filter((token) => token.length > 2 && name.includes(token)).length * 2;
    return score;
  }

  async function findSimilarArtigiani(search) {
    const allArtigiani = await getDirectoryOverview(appContext.dbPool);
    return allArtigiani
      .map((artigiano) => ({ artigiano, score: scoreArtigianoMatch(artigiano, search) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.artigiano);
  }

  function shouldSkipSeo(req) {
    const first = String(req.params.categoriaSlug || req.params.interventoSlug || '').toLowerCase();
    return reservedRoots.has(first);
  }

  function getBaseUrl(req) {
    const configured = String(appContext.env.appBaseUrl || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
  }

  function renderInfoPage(res, page) {
    return res.render('public/info-page', page);
  }

  function getWidgetSelection(profile, requestedLimit) {
    const planLimits = {
      free: 5,
      base: 10,
      pro: 25,
      unlimited: null,
    };
    const planSlug = String((profile.artigiano.public_plan && profile.artigiano.public_plan.slug) || 'free').toLowerCase();
    const safeRequested = Math.min(Math.max(Number(requestedLimit || 6), 1), 25);
    const allowedLimit = Object.prototype.hasOwnProperty.call(planLimits, planSlug) ? planLimits[planSlug] : 5;
    const finalLimit = allowedLimit === null ? safeRequested : Math.min(safeRequested, allowedLimit);
    return {
      planSlug,
      lavori: profile.lavori.slice(0, finalLimit).map((lavoro) => {
        const titolo = String(lavoro.titolo || '').trim().toLowerCase();
        const descrizione = String(lavoro.descrizione || '').trim();
        const normalizedDescription = descrizione.toLowerCase();
        let displayDescription = descrizione;

        if (titolo && normalizedDescription) {
          const sameStart = normalizedDescription.startsWith(titolo);
          const titleWords = titolo.split(/\s+/).filter(Boolean);
          const overlappingWords = titleWords.filter((word) => word.length > 3 && normalizedDescription.includes(word));
          if (sameStart || overlappingWords.length >= Math.max(2, Math.ceil(titleWords.length / 2))) {
            displayDescription = '';
          }
        }

        return {
          ...lavoro,
          display_description: displayDescription,
        };
      }),
      widgetCta: planSlug === 'free' && profile.lavori.length >= 5,
    };
  }

  async function renderSeoPage(req, res, next) {
    try {
      if (shouldSkipSeo(req)) return next();

      const seoPage = await getSeoWorksPage(appContext.dbPool, {
        categoriaSlug: req.params.categoriaSlug || '',
        interventoSlug: req.params.interventoSlug || '',
        cittaSlug: req.params.cittaSlug || '',
        quartiereSlug: req.params.quartiereSlug || '',
      });

      if (!seoPage.lavori.length) return next();

      res.render('public/seo-works', seoPage);
    } catch (error) {
      next(error);
    }
  }

  async function renderSeoWorkDetail(req, res, next) {
    try {
      if (shouldSkipSeo(req)) return next();

      const lavoro = await getSeoWorkDetail(appContext.dbPool, {
        categoriaSlug: req.params.categoriaSlug,
        interventoSlug: req.params.interventoSlug,
        cittaSlug: req.params.cittaSlug,
        quartiereSlug: req.params.quartiereSlug,
        artigianoSlug: req.params.artigianoSlug,
        lavoroSlug: req.params.lavoroSlug,
      });

      if (!lavoro) return next();

      return res.redirect(302, buildPublicWorkPath(lavoro));
    } catch (error) {
      next(error);
    }
  }

  async function renderWorkDetail(req, res, next) {
    try {
      const lavoro = await getWorkDetailByPublicPath(appContext.dbPool, {
        categoriaSlug: req.params.categoriaSlug,
        interventoSlug: req.params.interventoSlug,
        cittaSlug: req.params.cittaSlug,
        quartiereSlug: req.params.quartiereSlug,
        artigianoSlug: req.params.artigianoSlug,
      });
      if (!lavoro) return next();
      const recensioni = await getReviewsForWork(appContext.dbPool, lavoro.artigiano_slug, lavoro.slug);
      res.render('public/work-detail', {
        lavoro,
        recensioni,
        baseUrl: getBaseUrl(req),
        canonicalUrl: `${getBaseUrl(req)}${buildPublicWorkPath(lavoro)}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async function redirectLegacyWorkDetail(req, res, next) {
    try {
      const lavoro = await getWorkDetailBySlug(appContext.dbPool, req.params.lavoroSlug);
      if (!lavoro) return next();
      return res.redirect(302, buildPublicWorkPath(lavoro));
    } catch (error) {
      next(error);
    }
  }

  router.get('/', async (req, res, next) => {
    try {
      const [allArtigiani, lavori, recensioni, searchWorks] = await Promise.all([
        getDirectoryOverview(appContext.dbPool),
        getLatestWorks(appContext.dbPool),
        getLatestReviews(appContext.dbPool),
        searchSimilarWorks(appContext.dbPool, {
          q: req.query.q || '',
          citta: req.query.citta || '',
        }),
      ]);

      const q = String(req.query.q || '').trim().toLowerCase();
      const citta = String(req.query.citta || '').trim().toLowerCase();
      const intent = resolveSearchIntent(req.query.q || '');
      const rankedArtigiani = allArtigiani
        .map((artigiano) => {
          const descriptionText = [
            artigiano.descrizione_attivita,
            artigiano.bio,
          ].filter(Boolean).join(' ');

          const haystack = [
            artigiano.nome,
            artigiano.categoria_nome,
            artigiano.categoria_slug,
            descriptionText,
            artigiano.citta_principale,
          ].filter(Boolean).join(' ');

          let score = scoreTextAgainstIntent(haystack, intent);
          score += scoreTextAgainstIntent(descriptionText, intent) * 1.5;
          if (intent.inferredCategorySlug) {
            const categoryText = String(artigiano.categoria_slug || artigiano.categoria_nome || '').toLowerCase();
            if (categoryText.includes(intent.inferredCategorySlug.toLowerCase())) score += 10;
          }
          if (citta && String(artigiano.citta_principale || '').toLowerCase().includes(citta)) score += 8;
          score += Math.min(Number(artigiano.rating_avg || 0), 5);
          score += Math.min(Number(artigiano.reviews_count || 0), 10) * 0.2;

          return { artigiano, score };
        })
        .filter(({ artigiano, score }) => {
          const matchesCitta = !citta || String(artigiano.citta_principale || '').toLowerCase().includes(citta);
          const matchesQ = !q || score > 0;
          return matchesCitta && matchesQ;
        });

      const exactCategoryArtigiani = intent.inferredCategorySlug
        ? rankedArtigiani.filter(({ artigiano }) => String(artigiano.categoria_slug || artigiano.categoria_nome || '').toLowerCase().includes(intent.inferredCategorySlug.toLowerCase()))
        : [];

      const artigiani = (exactCategoryArtigiani.length ? exactCategoryArtigiani : rankedArtigiani)
        .sort((a, b) => b.score - a.score)
        .map(({ artigiano }) => artigiano);

      const fallbackArtigiani = (!searchWorks.length && (q || citta))
        ? artigiani
          .slice(0, 24)
          .map((artigiano, index) => {
            const cityKey = String(artigiano.citta_principale || '').toLowerCase();
            const coords = cityCoordinates[cityKey] || null;
            return {
              ...artigiano,
              search_score: (exactCategoryArtigiani.length ? exactCategoryArtigiani : rankedArtigiani)[index]?.score || 0,
              map_lat: coords ? coords.lat : null,
              map_lng: coords ? coords.lng : null,
            };
          })
        : [];

      const featuredArtigianiPool = buildFeaturedArtigianiPool(
        artigiani.length ? artigiani : allArtigiani,
        intent,
        citta
      ).slice(0, 36);
      const featuredArtigiani = featuredArtigianiPool.slice(0, 6);

      res.render('public/home', {
        artigiani,
        featuredArtigiani,
        featuredArtigianiPool,
        totalArtigiani: allArtigiani.length,
        lavori,
        searchWorks,
        fallbackArtigiani,
        recensioni,
        searchIntent: intent,
        twilioEnabled: appContext.twilio.enabled,
        searchState: {
          q: req.query.q || '',
          citta: req.query.citta || '',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/chi-siamo', (req, res) => renderInfoPage(res, {
    title: 'Chi siamo',
    eyebrow: 'StelleVere',
    intro: 'StelleVere mette in relazione clienti e aziende artigiane attraverso lavori reali pubblicati, recensioni legate al singolo intervento e presenza locale concreta.',
    sections: [
      {
        title: 'Cosa facciamo',
        body: 'Su StelleVere le persone non trovano solo profili, ma lavori realmente svolti in città e quartieri specifici. Questo rende più semplice capire chi ha già fatto interventi simili nella propria zona.',
      },
      {
        title: 'Perché nasce',
        body: 'Molte directory mostrano elenchi generici e recensioni poco contestualizzate. StelleVere nasce per valorizzare lavori veri, richieste recensione tracciabili e profili di aziende artigiane con partita IVA.',
      },
    ],
  }));

  router.get('/privacy-policy', (req, res) => renderInfoPage(res, {
    title: 'Privacy Policy',
    eyebrow: 'Legale',
    intro: 'Questa pagina descrive in modo sintetico come StelleVere tratta i dati personali di utenti e aziende artigiane durante navigazione, ricerca, rivendicazione attività e pubblicazione lavori.',
    sections: [
      {
        title: 'Dati trattati',
        body: 'Possiamo trattare dati di contatto, dati di registrazione, dati relativi ai lavori pubblicati, recensioni, informazioni tecniche di navigazione e dati necessari alla verifica della titolarità di un’attività.',
      },
      {
        title: 'Finalità principali',
        body: 'I dati vengono usati per mostrare i profili pubblici, consentire la gestione delle attività, inviare conferme e codici di verifica, migliorare la ricerca locale e mantenere il funzionamento della piattaforma.',
      },
    ],
  }));

  router.get('/cookie-policy', (req, res) => renderInfoPage(res, {
    title: 'Gestione cookie',
    eyebrow: 'Legale',
    intro: 'StelleVere utilizza strumenti tecnici necessari al funzionamento del sito e può utilizzare cookie o strumenti simili per migliorare esperienza, sicurezza, statistiche e preferenze di navigazione.',
    sections: [
      {
        title: 'Cookie tecnici',
        body: 'Sono quelli necessari al corretto funzionamento delle pagine, della navigazione, della sicurezza e di alcune funzioni come mappe, dashboard e accesso rapido.',
      },
      {
        title: 'Preferenze e consenso',
        body: 'Quando verrà attivata una gestione completa del consenso, l’utente potrà scegliere in modo chiaro quali categorie accettare o modificare in un secondo momento.',
      },
    ],
  }));

  router.get('/come-funziona', (req, res) => renderInfoPage(res, {
    title: 'Come funziona',
    eyebrow: 'Per clienti e artigiani',
    intro: 'Su StelleVere i clienti cercano lavori reali e gli artigiani pubblicano interventi effettivamente svolti nella propria zona.',
    sections: [
      {
        title: 'Per chi cerca un artigiano',
        body: 'Puoi cercare per tipo di lavoro e città, vedere lavori simili in mappa, aprire la pagina del singolo intervento e poi contattare l’artigiano più adatto.',
      },
      {
        title: 'Per le aziende artigiane',
        body: 'Puoi cercare la tua attività, rivendicarla oppure crearla, completare il profilo, pubblicare i tuoi lavori, raccogliere recensioni specifiche e rafforzare la tua presenza nella tua zona.',
      },
    ],
  }));

  router.get('/for-artigiani', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const citta = String(req.query.citta || '').trim().toLowerCase();
    const register = req.query.register === '1';

    getDirectoryOverview(appContext.dbPool)
      .then((allArtigiani) => {
        const results = allArtigiani.filter((artigiano) => {
          const matchesQ = !q || [
            artigiano.nome,
            artigiano.telefono,
            artigiano.categoria_nome,
          ].some((value) => String(value || '').toLowerCase().includes(q));
          const matchesCitta = !citta || String(artigiano.citta_principale || '').toLowerCase().includes(citta);
          return matchesQ && matchesCitta;
        }).slice(0, 24);

        res.render('public/for-artigiani', {
          searchState: {
            q: req.query.q || '',
            citta: req.query.citta || '',
          },
          results,
          searched: Boolean(q || citta),
          register,
          created: req.query.created === '1',
          confirmationEmail: req.query.email || '',
          confirmationPreview: req.query.preview || '',
          duplicateCandidates: [],
          draft: {
            nome_attivita: '',
            categoria: '',
            indirizzo_via: '',
            indirizzo_numero_civico: '',
            indirizzo_cap: '',
            citta: '',
            indirizzo_provincia: 'RM',
            telefono: '',
            partita_iva: '',
            email: '',
            sito_web: '',
            facebook_url: '',
            instagram_url: '',
            tiktok_url: '',
            referente: '',
            descrizione_attivita: '',
            logo_data: '',
            foto_1_data: '',
            foto_2_data: '',
            foto_3_data: '',
            consenso_termini: false,
            consenso_privacy: false,
            consenso_email: false,
          },
          error: '',
        });
      })
      .catch((error) => {
        res.status(500).json({ success: false, message: error.message || 'Errore caricamento pagina artigiani.' });
      });
  });

  router.post('/for-artigiani/nuova-scheda', (req, res) => {
    const payload = {
      nome_attivita: req.body.nome_attivita || '',
      categoria: req.body.categoria || '',
      indirizzo_via: req.body.indirizzo_via || '',
      indirizzo_numero_civico: req.body.indirizzo_numero_civico || '',
      indirizzo_cap: req.body.indirizzo_cap || '',
      citta: req.body.citta || '',
      indirizzo_provincia: req.body.indirizzo_provincia || 'RM',
      telefono: req.body.telefono || '',
      partita_iva: req.body.partita_iva || '',
      email: req.body.email || '',
      orari_apertura: buildHoursFromPayload(req.body),
      sito_web: req.body.sito_web || '',
      facebook_url: req.body.facebook_url || '',
      instagram_url: req.body.instagram_url || '',
      tiktok_url: req.body.tiktok_url || '',
      referente: req.body.referente || '',
      descrizione_attivita: req.body.descrizione_attivita || '',
      logo_data: req.body.logo_data || '',
      foto_1_data: req.body.foto_1_data || '',
      foto_2_data: req.body.foto_2_data || '',
      foto_3_data: req.body.foto_3_data || '',
      consenso_termini: req.body.consenso_termini === 'on',
      consenso_privacy: req.body.consenso_privacy === 'on',
      consenso_email: req.body.consenso_email === 'on',
      duplicate_confirmed: req.body.duplicate_confirmed || '',
    };
    payload.indirizzo = buildAddressString(payload);

    if (
      !String(payload.nome_attivita).trim() ||
      !String(payload.indirizzo_via).trim() ||
      !String(payload.indirizzo_numero_civico).trim() ||
      !String(payload.indirizzo_cap).trim() ||
      !String(payload.citta).trim() ||
      !String(payload.indirizzo_provincia).trim() ||
      !String(payload.telefono).trim() ||
      !String(payload.partita_iva).trim() ||
      !String(payload.email).trim() ||
      !payload.consenso_termini ||
      !payload.consenso_privacy ||
      !payload.consenso_email
    ) {
      return res.status(400).render('public/for-artigiani', {
        searchState: {
          q: '',
          citta: payload.citta,
        },
        results: [],
        searched: false,
        register: true,
        created: false,
        confirmationEmail: '',
        confirmationPreview: '',
        duplicateCandidates: [],
        error: 'Compila i dati principali dell’attività, inserisci email e consensi richiesti per completare la registrazione.',
        draft: payload,
      });
    }
    return findSimilarArtigiani(payload).then((duplicateCandidates) => {
      if (duplicateCandidates.length && payload.duplicate_confirmed !== 'no') {
        return res.status(200).render('public/for-artigiani', {
          searchState: {
            q: payload.nome_attivita,
            citta: payload.citta,
          },
          results: [],
          searched: true,
          register: true,
          created: false,
          confirmationEmail: '',
          confirmationPreview: '',
          duplicateCandidates,
          error: '',
          draft: payload,
        });
      }

      const request = createProfileRequest(payload);
      return res.redirect(`/for-artigiani?created=1&email=${encodeURIComponent(request.email)}&preview=${encodeURIComponent(`/for-artigiani/conferma/${request.email_confirmation_token}`)}`);
    }).catch((error) => {
      return res.status(500).json({ success: false, message: error.message || 'Errore durante la verifica attività.' });
    });
  });

  router.get('/for-artigiani/conferma/:token', (req, res) => {
    const existing = findProfileRequestByToken(req.params.token);
    if (!existing) {
      return res.status(404).render('public/not-found', {
        title: 'Link non valido',
        message: 'Il link di conferma non è valido o non è più disponibile.',
      });
    }

    const request = confirmProfileRequest(req.params.token);
    return res.render('public/for-artigiani-confirmed', {
      request,
    });
  });

  router.get('/:categoriaSlug/:interventoSlug/:cittaSlug/:quartiereSlug/:artigianoSlug', renderWorkDetail);
  router.get('/l:categoriaSlug/:publicSlug', redirectLegacyWorkDetail);
  router.get('/lavoro/:lavoroSlug', redirectLegacyWorkDetail);

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      app: 'stellevere-v2',
      dbConfigured: Boolean(appContext.dbPool),
      fallbackLegacy: true,
      twilioEnabled: appContext.twilio.enabled,
    });
  });

  router.get('/artigiano/:slug', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).render('public/not-found', {
          title: 'Artigiano non trovato',
          message: 'La scheda richiesta non è presente nel database V2.',
        });
      }

      res.render('public/artisan-profile', {
        ...profile,
        baseUrl: getBaseUrl(req),
        canonicalUrl: `${getBaseUrl(req)}/artigiano/${profile.artigiano.slug}`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/embed/:slug', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).render('public/not-found', {
          title: 'Attività non trovata',
          message: 'Non possiamo mostrare il widget perché l’attività non esiste.',
        });
      }

      const selection = getWidgetSelection(profile, req.query.limit || 6);

      res.render('public/artisan-widget', {
        artigiano: profile.artigiano,
        lavori: selection.lavori,
        baseUrl: getBaseUrl(req),
        canonicalUrl: `${getBaseUrl(req)}/artigiano/${profile.artigiano.slug}`,
        widgetCta: selection.widgetCta,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/embed/:slug/html', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).send('<section><p>Attività non trovata.</p></section>');
      }

      const selection = getWidgetSelection(profile, req.query.limit || 6);
      res.render('public/artisan-widget-html', {
        layout: false,
        artigiano: profile.artigiano,
        lavori: selection.lavori,
        baseUrl: getBaseUrl(req),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/claim/:slug', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).render('public/not-found', {
          title: 'Artigiano non trovato',
          message: 'Non possiamo avviare la rivendicazione perché la scheda non esiste.',
        });
      }

      res.render('public/claim-start', {
        artigiano: profile.artigiano,
        started: false,
        pendingClaim: await getPendingClaim(appContext.dbPool, profile.artigiano),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/claim/:slug', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).render('public/not-found', {
          title: 'Artigiano non trovato',
          message: 'Non possiamo avviare la rivendicazione perché la scheda non esiste.',
        });
      }

      const delivery = await initiateClaim(appContext.dbPool, profile.artigiano, appContext.twilio);
      res.render('public/claim-start', {
        artigiano: profile.artigiano,
        started: true,
        delivery,
        pendingClaim: await getPendingClaim(appContext.dbPool, profile.artigiano),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/claim/:slug/verifica', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).render('public/not-found', {
          title: 'Artigiano non trovato',
          message: 'La scheda richiesta non esiste.',
        });
      }

      res.render('public/claim-verify', {
        artigiano: profile.artigiano,
        pendingClaim: await getPendingClaim(appContext.dbPool, profile.artigiano),
        errore: '',
        successo: false,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/claim/:slug/verifica', async (req, res, next) => {
    try {
      const profile = await getPublicArtisanProfile(appContext.dbPool, req.params.slug);
      if (!profile) {
        return res.status(404).render('public/not-found', {
          title: 'Artigiano non trovato',
          message: 'La scheda richiesta non esiste.',
        });
      }

      const result = await verifyClaimCode(appContext.dbPool, profile.artigiano, req.body.codice);
      res.render('public/claim-verify', {
        artigiano: profile.artigiano,
        pendingClaim: await getPendingClaim(appContext.dbPool, profile.artigiano),
        errore: result.ok ? '' : result.message,
        successo: result.ok,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/recensione/:artigianoSlug/:lavoroSlug', async (req, res, next) => {
    try {
      const target = await getReviewTarget(appContext.dbPool, req.params.artigianoSlug, req.params.lavoroSlug);
      if (!target) {
        return res.status(404).render('public/not-found', {
          title: 'Lavoro non trovato',
          message: 'Il lavoro che vuoi recensire non è disponibile.',
        });
      }

      res.render('public/job-review', {
        lavoro: target,
        error: '',
        success: false,
        values: {
          cliente_nome: '',
          voto: '5',
          testo: '',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/recensione/:artigianoSlug/:lavoroSlug', async (req, res, next) => {
    try {
      const target = await getReviewTarget(appContext.dbPool, req.params.artigianoSlug, req.params.lavoroSlug);
      if (!target) {
        return res.status(404).render('public/not-found', {
          title: 'Lavoro non trovato',
          message: 'Il lavoro che vuoi recensire non è disponibile.',
        });
      }

      const result = await submitWorkReview(appContext.dbPool, req.params.artigianoSlug, req.params.lavoroSlug, req.body);
      res.render('public/job-review', {
        lavoro: target,
        error: result.ok ? '' : result.message,
        success: result.ok,
        values: {
          cliente_nome: req.body.cliente_nome || '',
          voto: req.body.voto || '5',
          testo: req.body.testo || '',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:categoriaSlug', async (req, res, next) => {
    try {
      if (reservedRoots.has(String(req.params.categoriaSlug || '').toLowerCase())) return next();

      const categoryPage = await getCategoryDirectoryPage(appContext.dbPool, req.params.categoriaSlug, {
        regione: req.query.regione || '',
        provincia: req.query.provincia || '',
        citta: req.query.citta || '',
        quartiere: req.query.quartiere || '',
      });
      if (categoryPage) {
        const worksData = await getCategoryWorksDirectory(appContext.dbPool, {
          categoriaSlug: categoryPage.categoriaSlug,
          citta: req.query.citta || '',
          quartiere: req.query.quartiere || '',
          intervento: req.query.intervento || '',
        });
        return res.render('public/category-directory', {
          ...categoryPage,
          ...worksData,
          selectedIntervento: req.query.intervento || '',
        });
      }

      return renderSeoPage(req, res, next);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:categoriaSlug/:interventoSlug/:cittaSlug/:quartiereSlug/:artigianoSlug/:lavoroSlug', renderSeoWorkDetail);
  router.get('/:categoriaSlug/:interventoSlug/:cittaSlug/:quartiereSlug', renderSeoPage);
  router.get('/:categoriaSlug/:interventoSlug/:cittaSlug', renderSeoPage);
  router.get('/:categoriaSlug/:interventoSlug', renderSeoPage);

  return router;
}

module.exports = {
  createPublicRouter,
};
