const {
  findArtigianoBySlug,
  listArtigianoWorks,
  updateArtigianoProfileBySlug,
} = require('../../repositories/artigiani-repo');
const { createLavoro, findLavoroByArtigianoAndSlug, updateLavoro } = require('../../repositories/lavori-repo');
const {
  PLAN_DEFS,
  buildDashboardProfile,
  updateDashboardProfile,
  buildHours,
  parseAddress,
  buildAddressString,
  buildHoursFromPayload,
} = require('../../data/dashboard-store');
const { addLocalDashboardJob, findLocalDashboardJob, updateLocalDashboardJob } = require('../../data/dashboard-jobs-store');
const { formatDisplayPhone } = require('../../services/phone-service');

const JOB_CATEGORY_OPTIONS = [
  { slug: 'idraulica', nome: 'Idraulica' },
  { slug: 'elettricista', nome: 'Elettricista' },
  { slug: 'imbianchino', nome: 'Imbianchino' },
  { slug: 'muratore', nome: 'Muratore' },
  { slug: 'falegname', nome: 'Falegname' },
  { slug: 'altro', nome: 'Altro' },
];

const JOB_EXAMPLES_BY_CATEGORY = {
  idraulica: [
    { titolo: 'Sostituzione Caldaia a Condensazione', tipo_nome: 'sostituzione caldaia', descrizione: 'Sostituzione caldaia murale con modello a condensazione classe A. Collaudo e certificazione inclusi.' },
    { titolo: 'Rifacimento Bagno Completo', tipo_nome: 'rifacimento bagno', descrizione: 'Ristrutturazione bagno con demolizione, nuovi sanitari sospesi, box doccia, piastrelle e rubinetteria.' },
    { titolo: 'Sostituzione Rubinetteria Bagno', tipo_nome: 'sostituzione rubinetto', descrizione: 'Sostituzione completa dei miscelatori bagno e cucina con modelli a risparmio idrico certificati.' },
  ],
  elettricista: [
    { titolo: 'Impianto Elettrico Appartamento', tipo_nome: 'rifacimento impianto elettrico', descrizione: 'Rifacimento completo impianto elettrico con quadro moderno, differenziali e prese a norma CEI 64-8.' },
    { titolo: 'Installazione Climatizzatore', tipo_nome: 'installazione climatizzatore', descrizione: 'Installazione split inverter con foratura muro, collegamenti, prova funzionale e collaudo finale.' },
    { titolo: 'Sostituzione Quadro Elettrico', tipo_nome: 'sostituzione quadro elettrico', descrizione: 'Sostituzione quadro obsoleto con nuovo centralino, differenziali separati e verifica finale dell’impianto.' },
  ],
  imbianchino: [
    { titolo: 'Tinteggiatura Appartamento Completo', tipo_nome: 'tinteggiatura interni', descrizione: 'Preparazione pareti, stucco, primer e due mani di pittura lavabile traspirante su appartamento completo.' },
    { titolo: 'Rifacimento Intonaco Facciata', tipo_nome: 'tinteggiatura esterni', descrizione: 'Rasatura e tinteggiatura facciata esterna con pittura silossanica idrorepellente.' },
    { titolo: 'Stucco Veneziano Camera da Letto', tipo_nome: 'stucco veneziano', descrizione: 'Applicazione stucco veneziano a due strati con finitura a cera e lucidatura finale.' },
  ],
  muratore: [
    { titolo: 'Posa Pavimento Gres Porcellanato', tipo_nome: 'posa pavimenti', descrizione: 'Posa gres porcellanato su massetto autolivellante con fughe e rifiniture complete.' },
    { titolo: 'Impermeabilizzazione Terrazzo', tipo_nome: 'impermeabilizzazione', descrizione: 'Rifacimento impermeabilizzazione terrazza con nuova guaina e ripristino finale della pavimentazione.' },
    { titolo: 'Ristrutturazione Completa Appartamento', tipo_nome: 'ristrutturazione completa', descrizione: 'Intervento completo con demolizioni, ricostruzioni, rasature e coordinamento lavorazioni di cantiere.' },
  ],
  falegname: [
    { titolo: 'Cucina su Misura', tipo_nome: 'cucina su misura', descrizione: 'Progettazione e realizzazione cucina su misura con rilievo, produzione artigianale e montaggio finale.' },
    { titolo: 'Armadio a Muro con Ante Scorrevoli', tipo_nome: 'armadio su misura', descrizione: 'Armadio su misura con ante scorrevoli, interni organizzati e chiusure ammortizzate.' },
    { titolo: 'Restauro Mobili Antichi', tipo_nome: 'restauro mobili', descrizione: 'Restauro conservativo di mobili antichi con trattamento, ripristino finiture e protezione finale.' },
  ],
  altro: [
    { titolo: 'Montaggio Mobili', tipo_nome: 'montaggio mobili', descrizione: 'Montaggio e assemblaggio mobili con attrezzatura professionale e verifica finale della stabilità.' },
    { titolo: 'Installazione Condizionatore', tipo_nome: 'installazione condizionatore', descrizione: 'Installazione split con collegamenti, staffaggi e controllo finale di funzionamento.' },
    { titolo: 'Manutenzione Giardino', tipo_nome: 'manutenzione giardino', descrizione: 'Taglio erba, potatura siepi, pulizia area verde e riordino finale dello spazio esterno.' },
  ],
};

const EXTRA_JOB_EXAMPLES_BY_CATEGORY = {
  idraulica: [
    { titolo: 'Ricerca Perdita Acqua', descrizione: 'Individuazione perdita su impianto idrico con ripristino del tratto danneggiato e verifica finale.' },
    { titolo: 'Sostituzione Scaldabagno', descrizione: 'Rimozione vecchio scaldabagno e installazione nuovo apparecchio con prova di funzionamento.' },
    { titolo: 'Disotturazione Scarico Cucina', descrizione: 'Pulizia e ripristino scarico cucina ostruito con controllo del corretto deflusso.' },
    { titolo: 'Installazione Box Doccia', descrizione: 'Montaggio box doccia con sigillatura, collegamenti e rifiniture finali.' },
  ],
  elettricista: [
    { titolo: 'Sostituzione Citofono', descrizione: 'Rimozione del vecchio citofono e installazione nuovo apparecchio con test audio e apertura.' },
    { titolo: 'Nuovi Punti Luce', descrizione: 'Predisposizione e collegamento di nuovi punti luce con verifica finale dell’impianto.' },
    { titolo: 'Installazione Ventilatore a Soffitto', descrizione: 'Montaggio ventilatore, collegamenti elettrici e collaudo del telecomando o interruttore.' },
    { titolo: 'Adeguamento Prese Elettriche', descrizione: 'Sostituzione prese obsolete e verifica sicurezza con test finale.' },
  ],
  imbianchino: [
    { titolo: 'Ripristino Pareti Umide', descrizione: 'Trattamento antiumidità, rasatura e nuova tinteggiatura con prodotti traspiranti.' },
    { titolo: 'Tinteggiatura Ufficio', descrizione: 'Protezione arredi, preparazione superfici e finitura pareti in ambiente ufficio.' },
    { titolo: 'Verniciatura Ringhiere', descrizione: 'Carteggiatura, fondo protettivo e verniciatura finale di ringhiere metalliche.' },
    { titolo: 'Decorazione Parete Soggiorno', descrizione: 'Applicazione finitura decorativa su parete principale con protezione e pulizia finale.' },
  ],
  muratore: [
    { titolo: 'Rifacimento Massetto', descrizione: 'Demolizione del sottofondo esistente e realizzazione nuovo massetto pronto per la posa.' },
    { titolo: 'Costruzione Tramezzo Interno', descrizione: 'Realizzazione divisorio interno con laterizi, rasatura e preparazione alla finitura.' },
    { titolo: 'Ripristino Balcone', descrizione: 'Intervento su frontalini e pavimentazione balcone con rifiniture finali.' },
    { titolo: 'Riparazione Crepe Pareti', descrizione: 'Apertura, stuccatura e rasatura crepe con ripristino della superficie.' },
  ],
  falegname: [
    { titolo: 'Libreria su Misura', descrizione: 'Realizzazione libreria artigianale su misura con rilievo, produzione e montaggio.' },
    { titolo: 'Porta Interna su Misura', descrizione: 'Produzione e installazione porta interna con ferramenta e regolazioni finali.' },
    { titolo: 'Mobile Bagno su Misura', descrizione: 'Creazione mobile bagno personalizzato con installazione e rifiniture.' },
    { titolo: 'Riparazione Serramenti in Legno', descrizione: 'Ripristino ante o infissi in legno con sistemazione chiusure e finitura.' },
  ],
  altro: [
    { titolo: 'Pulizia Post Cantiere', descrizione: 'Pulizia finale degli ambienti dopo lavori edili con smaltimento residui leggeri.' },
    { titolo: 'Montaggio Tenda da Sole', descrizione: 'Installazione struttura, fissaggi e regolazione finale della tenda da sole.' },
    { titolo: 'Sostituzione Serratura', descrizione: 'Rimozione serratura danneggiata e installazione nuova con test delle chiavi.' },
    { titolo: 'Piccole Riparazioni Casa', descrizione: 'Interventi di manutenzione domestica con sistemazione finale dell’area di lavoro.' },
  ],
};

function ensureMinimumExamples(categorySlug, examples) {
  const seeded = [...examples];
  const extras = EXTRA_JOB_EXAMPLES_BY_CATEGORY[categorySlug] || [];

  extras.forEach((item) => {
    if (seeded.length < 7) {
      seeded.push({
        titolo: item.titolo,
        tipo_nome: item.titolo,
        descrizione: item.descrizione,
      });
    }
  });

  while (seeded.length < 7) {
    seeded.push({
      titolo: `Esempio ${seeded.length + 1}`,
      tipo_nome: `Esempio ${seeded.length + 1}`,
      descrizione: 'Adatta questo modello al lavoro svolto, indicando materiali, intervento eseguito e risultato finale.',
    });
  }

  seeded.push({
    titolo: 'Scheda vuota',
    tipo_nome: 'Scheda vuota',
    descrizione: '',
    is_blank: true,
  });

  return seeded;
}

function buildExampleImageDataUri(categorySlug, title) {
  const themes = {
    idraulica: { bg1: '#c8e7ef', bg2: '#7db7c9', accent: '#1d6d84', label: 'Idraulica' },
    elettricista: { bg1: '#f5df9d', bg2: '#efba40', accent: '#8f5a00', label: 'Elettrico' },
    imbianchino: { bg1: '#f3d7d4', bg2: '#d99b95', accent: '#8f4e48', label: 'Finiture' },
    muratore: { bg1: '#d9d0c6', bg2: '#b69c82', accent: '#5a4635', label: 'Muratura' },
    falegname: { bg1: '#ead4b7', bg2: '#c69b6b', accent: '#6c4722', label: 'Legno' },
    altro: { bg1: '#d6e1c8', bg2: '#9fb58a', accent: '#4a6233', label: 'Servizi' },
  };

  const theme = themes[categorySlug] || themes.altro;
  const safeTitle = String(title || theme.label)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.bg1}" />
          <stop offset="100%" stop-color="${theme.bg2}" />
        </linearGradient>
      </defs>
      <rect width="800" height="520" rx="36" fill="url(#g)" />
      <circle cx="120" cy="120" r="68" fill="rgba(255,255,255,0.32)" />
      <circle cx="700" cy="84" r="44" fill="rgba(255,255,255,0.25)" />
      <rect x="72" y="328" width="656" height="120" rx="24" fill="rgba(255,255,255,0.78)" />
      <text x="72" y="122" font-family="Georgia, serif" font-size="34" fill="${theme.accent}" font-weight="700">${theme.label}</text>
      <text x="72" y="386" font-family="Georgia, serif" font-size="42" fill="${theme.accent}" font-weight="700">${safeTitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function enrichExamplesWithImages(examplesByCategory) {
  return Object.fromEntries(
    Object.entries(examplesByCategory).map(([categorySlug, examples]) => [
      categorySlug,
      ensureMinimumExamples(categorySlug, examples).map((example) => ({
        ...example,
        image_src: buildExampleImageDataUri(categorySlug, example.is_blank ? 'Scheda vuota' : example.titolo),
      })),
    ])
  );
}

function buildPlanFromUsage(jobCount) {
  if (jobCount > 25) return PLAN_DEFS.unlimited;
  if (jobCount > 10) return PLAN_DEFS.pro;
  if (jobCount > 5) return PLAN_DEFS.base;
  return PLAN_DEFS.free;
}

function normalizeDbHours(rawValue) {
  if (!rawValue) return buildHours();
  if (Array.isArray(rawValue)) return buildHours(rawValue);
  try {
    return buildHours(JSON.parse(rawValue));
  } catch (_) {
    return buildHours();
  }
}

function buildDashboardFromDb(artigiano, lavori) {
  const activeJobs = lavori.length;
  const activePlan = buildPlanFromUsage(activeJobs);
  const formattedAddress = buildAddressString(parseAddress(artigiano.sede_legale || `${artigiano.citta_principale || 'Milano'}`));
  return {
    artigiano: {
      ...artigiano,
      telefono: formatDisplayPhone(artigiano.telefono),
      sede_legale: formattedAddress,
      indirizzo: parseAddress(formattedAddress),
      website_url: artigiano.sito_web || '',
      facebook_url: artigiano.facebook_url || '',
      instagram_url: artigiano.instagram_url || '',
      tiktok_url: artigiano.tiktok_url || '',
      hours: normalizeDbHours(artigiano.orari_lavoro),
    },
    lavori: lavori.map((lavoro) => ({
      ...lavoro,
      review_path: `/recensione/${artigiano.slug}/${lavoro.slug}`,
      cliente_whatsapp: lavoro.cliente_whatsapp || '',
    })),
    stats: {
      activeJobs,
      availableSlots: activePlan.maxLavori === null ? null : Math.max(activePlan.maxLavori - activeJobs, 0),
      reviewsCount: artigiano.reviews_count || 0,
      averageRating: Number(artigiano.rating_avg || 0).toFixed(1),
    },
    plans: Object.values(PLAN_DEFS),
    activePlan,
    website: {
      enabled: Boolean(artigiano.website_enabled),
      activationPrice: '299',
      includesPlan: 'Base fino a 10 lavori',
      includesDuration: '12 mesi',
      previewUrl: `/artigiano/${artigiano.slug}`,
    },
  };
}

function mapPayloadForDb(payload) {
  return {
    nome: String(payload.nome || '').trim(),
    telefono: String(payload.telefono || '').trim(),
    sede_legale: buildAddressString(payload),
    orari_lavoro: JSON.stringify(buildHoursFromPayload(payload)),
    sito_web: String(payload.website_url || '').trim(),
    facebook_url: String(payload.facebook_url || '').trim(),
    instagram_url: String(payload.instagram_url || '').trim(),
    tiktok_url: String(payload.tiktok_url || '').trim(),
  };
}

async function getArtisanDashboard(pool, slug) {
  if (pool) {
    try {
      const artigiano = await findArtigianoBySlug(pool, slug);
      if (artigiano) {
        const lavori = await listArtigianoWorks(pool, artigiano.id);
        return buildDashboardFromDb(artigiano, lavori);
      }
    } catch (_) {}
  }
  return buildDashboardProfile(slug);
}

async function saveArtisanDashboardProfile(pool, slug, payload) {
  if (pool) {
    try {
      const updated = await updateArtigianoProfileBySlug(pool, slug, mapPayloadForDb(payload));
      if (updated) {
        const lavori = await listArtigianoWorks(pool, updated.id);
        return buildDashboardFromDb(updated, lavori);
      }
    } catch (_) {}
  }
  return updateDashboardProfile(slug, payload);
}

function getJobCategoryOptions() {
  return JOB_CATEGORY_OPTIONS;
}

function getJobExamplesByCategory() {
  return enrichExamplesWithImages(JOB_EXAMPLES_BY_CATEGORY);
}

function validateJobPayload(payload) {
  const titolo = String(payload.titolo || '').trim();
  const descrizione = String(payload.descrizione || '').trim();
  const citta = String(payload.citta || '').trim();
  const quartiere = String(payload.quartiere || '').trim();
  const categoriaSlug = String(payload.categoria_slug || '').trim();
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  let immagini = [];

  try {
    immagini = JSON.parse(String(payload.immagini_json || '[]'));
  } catch (_) {
    return 'Le immagini del lavoro non sono valide.';
  }

  if (titolo.length < 5) return 'Inserisci un titolo più descrittivo.';
  if (descrizione.length < 20) return 'Inserisci una descrizione di almeno 20 caratteri.';
  if (!citta) return 'Inserisci la città del lavoro.';
  if (!quartiere) return 'Inserisci il quartiere o la zona.';
  if (!categoriaSlug) return 'Seleziona la categoria del lavoro.';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Inserisci coordinate valide per il lavoro.';
  if (!Array.isArray(immagini) || immagini.length === 0) return 'Aggiungi almeno una immagine del lavoro.';
  if (immagini.length > 3) return 'Puoi allegare al massimo 3 immagini.';
  return '';
}

async function saveNewDashboardJob(pool, slug, payload) {
  const dashboard = await getArtisanDashboard(pool, slug);
  if (!dashboard) {
    return { ok: false, error: 'Dashboard non trovata.', dashboard: null };
  }

  const validationError = validateJobPayload(payload);
  if (validationError) {
    return { ok: false, error: validationError, dashboard };
  }

  if (dashboard.activePlan.maxLavori !== null && dashboard.stats.activeJobs >= dashboard.activePlan.maxLavori) {
    return {
      ok: false,
      error: `Hai raggiunto il limite del piano ${dashboard.activePlan.nome}. Per pubblicare altri lavori devi fare upgrade.`,
      dashboard,
      upgradeRequired: true,
    };
  }

  const category = JOB_CATEGORY_OPTIONS.find(item => item.slug === payload.categoria_slug) || JOB_CATEGORY_OPTIONS[JOB_CATEGORY_OPTIONS.length - 1];
  const immagini = JSON.parse(String(payload.immagini_json || '[]'));
  const derivedTipoNome = String(payload.titolo || '').trim();

  if (pool) {
    try {
      const artigiano = await findArtigianoBySlug(pool, slug);
      if (artigiano) {
        await createLavoro(pool, {
          artigianoId: artigiano.id,
          artigianoSlug: artigiano.slug,
          categoriaSlug: payload.categoria_slug,
          tipoNome: derivedTipoNome,
          titolo: String(payload.titolo || '').trim(),
          descrizione: String(payload.descrizione || '').trim(),
          citta: String(payload.citta || '').trim(),
          quartiere: String(payload.quartiere || '').trim(),
          indirizzoTestuale: '',
          lat: Number(payload.lat),
          lng: Number(payload.lng),
          immagini,
        });
        const updatedDashboard = await getArtisanDashboard(pool, slug);
        return { ok: true, dashboard: updatedDashboard };
      }
    } catch (_) {}
  }

  addLocalDashboardJob(slug, {
    ...payload,
    immagini,
    categoria_nome: category.nome,
    tipo_slug: derivedTipoNome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    tipo_nome: derivedTipoNome,
    cliente_whatsapp: String(payload.cliente_whatsapp || '').trim(),
  });

  const updatedDashboard = await getArtisanDashboard(pool, slug);
  return { ok: true, dashboard: updatedDashboard };
}

async function getDashboardJobEditor(pool, slug, jobSlug) {
  const dashboard = await getArtisanDashboard(pool, slug);
  if (!dashboard) return null;

  if (pool) {
    try {
      const lavoro = await findLavoroByArtigianoAndSlug(pool, slug, jobSlug);
      if (lavoro) {
        return {
          dashboard,
          lavoro: {
            ...lavoro,
            immagini: lavoro.cover_path ? [{ src: `/uploads/${lavoro.cover_path}`, name: lavoro.cover_alt || lavoro.titolo }] : [],
          },
        };
      }
    } catch (_) {}
  }

  const localJob = findLocalDashboardJob(slug, jobSlug);
  if (!localJob) return null;
  return { dashboard, lavoro: localJob };
}

async function updateDashboardJob(pool, slug, jobSlug, payload) {
  const dashboard = await getArtisanDashboard(pool, slug);
  if (!dashboard) {
    return { ok: false, error: 'Dashboard non trovata.', dashboard: null, lavoro: null };
  }

  const validationError = validateJobPayload(payload);
  if (validationError) {
    const existing = await getDashboardJobEditor(pool, slug, jobSlug);
    return { ok: false, error: validationError, dashboard, lavoro: existing ? existing.lavoro : null };
  }

  const category = JOB_CATEGORY_OPTIONS.find(item => item.slug === payload.categoria_slug) || JOB_CATEGORY_OPTIONS[JOB_CATEGORY_OPTIONS.length - 1];
  const immagini = JSON.parse(String(payload.immagini_json || '[]'));
  const derivedTipoNome = String(payload.titolo || '').trim();

  if (pool) {
    try {
      const artigiano = await findArtigianoBySlug(pool, slug);
      if (artigiano) {
        await updateLavoro(pool, {
          artigianoSlug: slug,
          lavoroSlug: jobSlug,
          categoriaSlug: payload.categoria_slug,
          tipoNome: derivedTipoNome,
          titolo: String(payload.titolo || '').trim(),
          descrizione: String(payload.descrizione || '').trim(),
          citta: String(payload.citta || '').trim(),
          quartiere: String(payload.quartiere || '').trim(),
          lat: Number(payload.lat),
          lng: Number(payload.lng),
          immagini,
        });
        const updatedDashboard = await getArtisanDashboard(pool, slug);
        return { ok: true, dashboard: updatedDashboard };
      }
    } catch (_) {}
  }

  const updated = updateLocalDashboardJob(slug, jobSlug, {
    ...payload,
    immagini,
    categoria_nome: category.nome,
    tipo_slug: derivedTipoNome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    tipo_nome: derivedTipoNome,
    cliente_whatsapp: String(payload.cliente_whatsapp || '').trim(),
  });

  if (!updated) {
    return { ok: false, error: 'Lavoro non trovato.', dashboard, lavoro: null };
  }

  const updatedDashboard = await getArtisanDashboard(pool, slug);
  return { ok: true, dashboard: updatedDashboard };
}

module.exports = {
  getArtisanDashboard,
  saveArtisanDashboardProfile,
  getJobCategoryOptions,
  getJobExamplesByCategory,
  saveNewDashboardJob,
  getDashboardJobEditor,
  updateDashboardJob,
};
