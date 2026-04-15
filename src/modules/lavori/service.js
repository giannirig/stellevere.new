const { listRecentLavori, listAllPublishedLavoriForSeo } = require('../../repositories/lavori-repo');
const { listLegacyLavori, getLegacyArtigianoProfile } = require('../../data/legacy-store');
const { listAllLocalDashboardJobs } = require('../../data/dashboard-jobs-store');
const { slugify } = require('../../services/slug-service');

const LOCATION_LOOKUP = {
  'roma': { lat: 41.9028, lng: 12.4964 },
  'roma|salario': { lat: 41.9326, lng: 12.4994 },
  'roma|prati': { lat: 41.9097, lng: 12.4606 },
  'roma|trastevere': { lat: 41.8897, lng: 12.4691 },
  'milano': { lat: 45.4642, lng: 9.19 },
  'milano|moscova': { lat: 45.4778, lng: 9.1853 },
  'milano|baggio': { lat: 45.4561, lng: 9.1105 },
  'torino': { lat: 45.0703, lng: 7.6869 },
  'napoli': { lat: 40.8518, lng: 14.2681 },
  'bologna': { lat: 44.4949, lng: 11.3426 },
  'firenze': { lat: 43.7696, lng: 11.2558 },
};

const CATEGORY_INTENTS = [
  {
    slug: 'idraulica',
    label: 'Idraulica',
    keywords: ['idraulico', 'idraulica', 'rubinetto', 'rubinetti', 'lavandino', 'wc', 'water', 'tubo', 'tubature', 'scarico', 'scarichi', 'perdita', 'perdite', 'caldaia', 'caldaie', 'scaldabagno', 'termosifone', 'termosifoni', 'boiler', 'bagno', 'sanitari', 'doccia', 'box doccia', 'piatto doccia', 'miscelatore', 'miscelatore doccia', 'soffione doccia'],
  },
  {
    slug: 'elettricista',
    label: 'Elettricista',
    keywords: ['elettricista', 'elettrico', 'elettrica', 'corrente', 'presa', 'prese', 'interruttore', 'interruttori', 'quadro', 'salvavita', 'citofono', 'illuminazione', 'luci', 'lampadario', 'impianto elettrico'],
  },
  {
    slug: 'imbianchino',
    label: 'Imbianchino',
    keywords: ['imbianchino', 'imbiancare', 'pittura', 'verniciatura', 'parete', 'pareti', 'muffa', 'stuccatura', 'cartongesso'],
  },
  {
    slug: 'falegname',
    label: 'Falegname',
    keywords: ['falegname', 'legno', 'armadio', 'mobile', 'mobili', 'cucina', 'porte interne', 'libreria'],
  },
  {
    slug: 'muratore',
    label: 'Muratore',
    keywords: ['muratore', 'muratura', 'ristrutturazione', 'piastrelle', 'pavimento', 'intonaco', 'muro', 'parete', 'demolizione'],
  },
  {
    slug: 'climatizzazione',
    label: 'Climatizzazione',
    keywords: ['climatizzatore', 'climatizzatori', 'climatizzazione', 'condizionatore', 'condizionatori', 'aria condizionata', 'split', 'pompa di calore', 'pompe di calore', 'installazione climatizzatore', 'installazione climatizzatori'],
  },
  {
    slug: 'serramentista',
    label: 'Serramentista',
    keywords: ['serramenti', 'infissi', 'finestra', 'finestre', 'porta finestra', 'zanzariera', 'zanzariere', 'persiana', 'persiane'],
  },
  {
    slug: 'fabbro',
    label: 'Fabbro',
    keywords: ['fabbro', 'serratura', 'serrature', 'porta blindata', 'cancello', 'inferriata', 'chiave', 'chiavi'],
  },
  {
    slug: 'giardiniere',
    label: 'Giardiniere',
    keywords: ['giardiniere', 'giardino', 'siepe', 'prato', 'potatura', 'potature', 'irrigazione', 'albero', 'alberi'],
  },
  {
    slug: 'caldaie',
    label: 'Caldaie',
    keywords: ['caldaia', 'caldaie', 'bruciatore', 'scaldabagno', 'boiler', 'termosifone', 'termosifoni'],
  },
];

function normalizeSlug(value) {
  return slugify(String(value || '').trim());
}

function unslug(value) {
  const text = String(value || '').replace(/-/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearch(value) {
  return normalizeSearchText(value).split(' ').filter((token) => token.length > 1);
}

function resolveSearchIntent(query) {
  const text = normalizeSearchText(query);
  const tokens = tokenizeSearch(query);
  if (!text) {
    return {
      normalizedQuery: '',
      inferredCategorySlug: '',
      inferredCategoryLabel: '',
      tokens: [],
      hasCategoryIntent: false,
    };
  }

  const ranked = CATEGORY_INTENTS
    .map((category) => {
      let score = 0;
      category.keywords.forEach((keyword) => {
        const normalizedKeyword = normalizeSearchText(keyword);
        if (!normalizedKeyword) return;
        if (text.includes(normalizedKeyword)) score += normalizedKeyword.includes(' ') ? 5 : 3;
        if (tokens.includes(normalizedKeyword)) score += 2;
      });
      if (text.includes(category.slug.replace(/-/g, ' '))) score += 4;
      return {
        ...category,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0] && ranked[0].score >= 3 ? ranked[0] : null;
  return {
    normalizedQuery: text,
    inferredCategorySlug: winner ? winner.slug : '',
    inferredCategoryLabel: winner ? winner.label : '',
    inferredCategoryKeywords: winner ? winner.keywords : [],
    tokens,
    hasCategoryIntent: Boolean(winner),
  };
}

function scoreTextAgainstIntent(textValue, intent) {
  const haystack = normalizeSearchText(textValue);
  if (!haystack) return 0;

  let score = 0;
  if (intent.normalizedQuery && haystack.includes(intent.normalizedQuery)) score += 12;
  (intent.tokens || []).forEach((token) => {
    if (haystack.includes(token)) score += 2;
  });
  (intent.inferredCategoryKeywords || []).forEach((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) return;
    if (haystack.includes(normalizedKeyword)) score += normalizedKeyword.includes(' ') ? 4 : 2;
  });

  return score;
}

function scoreWorkAgainstIntent(lavoro, intent) {
  const haystack = [
    lavoro.titolo,
    lavoro.descrizione,
    lavoro.tipo_nome,
    lavoro.categoria_nome,
    lavoro.categoria_slug,
  ].filter(Boolean).join(' ');

  let score = scoreTextAgainstIntent(haystack, intent);

  if (intent.inferredCategorySlug) {
    const categorySlug = normalizeSlug(lavoro.categoria_slug || lavoro.categoria_nome);
    if (categorySlug === normalizeSlug(intent.inferredCategorySlug)) score += 14;
  }

  return score;
}

function buildSeoWorkPath(job) {
  return `/${normalizeSlug(job.categoria_slug)}/${normalizeSlug(job.tipo_nome || job.titolo)}/${normalizeSlug(job.citta)}/${normalizeSlug(job.quartiere)}/${normalizeSlug(job.artigiano_slug)}/${normalizeSlug(job.slug)}`;
}

function compactInterventoSlug(value) {
  const parts = normalizeSlug(value).split('-').filter(Boolean);
  const stopwords = new Set(['a', 'ad', 'al', 'alla', 'alle', 'allo', 'ai', 'agli', 'con', 'da', 'dal', 'dalla', 'dalle', 'dello', 'del', 'della', 'di', 'e', 'il', 'la', 'le', 'lo', 'in', 'per', 'su']);
  const meaningful = parts.filter((part) => !stopwords.has(part));
  return meaningful.slice(0, 2).join('-') || parts.slice(0, 2).join('-') || normalizeSlug(value);
}

function buildPublicWorkSlug(job) {
  return [
    compactInterventoSlug(job.tipo_nome || job.titolo),
    normalizeSlug(job.citta),
    normalizeSlug(job.quartiere),
  ].filter(Boolean).join('-');
}

function buildPublicWorkPath(job) {
  return `/${normalizeSlug(job.categoria_slug)}/${compactInterventoSlug(job.tipo_nome || job.titolo)}/${normalizeSlug(job.citta)}/${normalizeSlug(job.quartiere)}/${normalizeSlug(job.artigiano_slug)}`;
}

function buildPublicWorksZonePath(job) {
  return `/${normalizeSlug(job.categoria_slug)}/${compactInterventoSlug(job.tipo_nome || job.titolo)}/${normalizeSlug(job.citta)}/${normalizeSlug(job.quartiere)}`;
}

function enrichLocalJob(job) {
  const legacyProfile = getLegacyArtigianoProfile(job.artigiano_slug);
  const immagini = Array.isArray(job.immagini)
    ? job.immagini.map((image, index) => ({
        src: image.src || '',
        alt: image.name || `${job.titolo} ${index + 1}`,
      }))
    : [];

  return {
    ...job,
    artigiano_nome: legacyProfile ? legacyProfile.artigiano.nome : job.artigiano_slug,
    categoria_nome: job.categoria_nome || 'Artigiano',
    tipo_nome: job.tipo_nome || job.titolo,
    tipo_slug: job.tipo_slug || normalizeSlug(job.titolo),
    seo_intervento_slug: normalizeSlug(job.tipo_nome || job.titolo),
    seo_citta_slug: normalizeSlug(job.citta),
    seo_quartiere_slug: normalizeSlug(job.quartiere),
    review_path: `/recensione/${job.artigiano_slug}/${job.slug}`,
    detail_path: buildPublicWorkPath(job),
    similar_zone_path: buildPublicWorksZonePath(job),
    immagini,
  };
}

function resolveCoordinates(job) {
  const lat = Number(job.lat);
  const lng = Number(job.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, isApproximate: false };
  }

  const cityKey = normalizeSlug(job.citta);
  const zoneKey = normalizeSlug(job.quartiere);
  const exact = LOCATION_LOOKUP[zoneKey ? `${cityKey}|${zoneKey}` : cityKey] || LOCATION_LOOKUP[cityKey];
  if (!exact) return { lat: null, lng: null, isApproximate: true };

  return {
    lat: exact.lat,
    lng: exact.lng,
    isApproximate: true,
  };
}

function enrichAnyJob(job) {
  const coords = resolveCoordinates(job);
  const immagini = Array.isArray(job.immagini) ? job.immagini : [];
  return {
    ...job,
    seo_intervento_slug: normalizeSlug(job.tipo_nome || job.titolo),
    seo_citta_slug: normalizeSlug(job.citta),
    seo_quartiere_slug: normalizeSlug(job.quartiere),
    review_path: `/recensione/${job.artigiano_slug}/${job.slug}`,
    detail_path: buildPublicWorkPath(job),
    similar_zone_path: buildPublicWorksZonePath(job),
    map_lat: coords.lat,
    map_lng: coords.lng,
    map_is_approximate: coords.isApproximate,
    immagini,
  };
}

async function getLatestWorks(pool) {
  try {
    const lavori = await listRecentLavori(pool);
    if (lavori.length) return lavori.map(enrichAnyJob);
  } catch (_) {}
  return [...listAllLocalDashboardJobs().map(enrichLocalJob), ...listLegacyLavori()].slice(0, 12).map(enrichAnyJob);
}

async function searchSimilarWorks(pool, filters) {
  const allWorks = await listWorksForSeo(pool);
  const intent = resolveSearchIntent(filters.q || '');
  const citta = normalizeSlug(filters.citta);

  const rankedWorks = allWorks
    .map(enrichAnyJob)
    .map((lavoro) => {
      const score = scoreWorkAgainstIntent(lavoro, intent);
      return { lavoro, score };
    })
    .filter(({ lavoro, score }) => {
      const matchesCitta = !citta || normalizeSlug(lavoro.citta) === citta;
      const matchesQ = !intent.normalizedQuery || score > 0;
      return matchesCitta && matchesQ;
    });

  const exactCategoryWorks = intent.inferredCategorySlug
    ? rankedWorks.filter(({ lavoro }) => normalizeSlug(lavoro.categoria_slug || lavoro.categoria_nome) === normalizeSlug(intent.inferredCategorySlug))
    : [];

  const finalWorks = exactCategoryWorks.length ? exactCategoryWorks : rankedWorks;
  return finalWorks
    .sort((a, b) => b.score - a.score)
    .map(({ lavoro }) => lavoro)
    .slice(0, 24);
}

async function listWorksForSeo(pool) {
  if (pool) {
    try {
      const lavori = await listAllPublishedLavoriForSeo(pool);
      if (lavori.length) return lavori.map(enrichAnyJob);
    } catch (_) {}
  }

  const localJobs = listAllLocalDashboardJobs().map(enrichLocalJob).map(enrichAnyJob);
  const legacyJobs = listLegacyLavori(1000).map(enrichAnyJob);
  return [...localJobs, ...legacyJobs];
}

async function getSeoWorksPage(pool, filters) {
  const allWorks = await listWorksForSeo(pool);
  const categoriaSlug = normalizeSlug(filters.categoriaSlug);
  const interventoSlug = normalizeSlug(filters.interventoSlug);
  const cittaSlug = normalizeSlug(filters.cittaSlug);
  const quartiereSlug = normalizeSlug(filters.quartiereSlug);

  const lavori = allWorks.filter((lavoro) => {
    if (categoriaSlug && normalizeSlug(lavoro.categoria_slug) !== categoriaSlug) return false;
    if (interventoSlug && compactInterventoSlug(lavoro.tipo_nome || lavoro.titolo) !== interventoSlug) return false;
    if (cittaSlug && normalizeSlug(lavoro.seo_citta_slug || lavoro.citta) !== cittaSlug) return false;
    if (quartiereSlug && normalizeSlug(lavoro.seo_quartiere_slug || lavoro.quartiere) !== quartiereSlug) return false;
    return true;
  });

  const labels = {
    categoria: lavori[0] ? lavori[0].categoria_nome : unslug(categoriaSlug),
    intervento: lavori[0] ? lavori[0].tipo_nome : unslug(interventoSlug),
    citta: lavori[0] ? lavori[0].citta : unslug(cittaSlug),
    quartiere: lavori[0] ? lavori[0].quartiere : unslug(quartiereSlug),
  };

  const titleParts = [
    labels.intervento,
    labels.categoria,
    labels.citta,
    labels.quartiere,
  ].filter(Boolean);

  const pageTitle = titleParts.length
    ? `${titleParts.join(' | ')} | StelleVere`
    : 'Lavori pubblicati | StelleVere';

  const intro = [
    labels.intervento ? `Scopri lavori reali di ${labels.intervento.toLowerCase()}` : 'Scopri lavori reali pubblicati',
    labels.categoria ? `eseguiti da artigiani ${labels.categoria.toLowerCase()}` : 'eseguiti da artigiani verificati',
    labels.citta ? `a ${labels.citta}` : '',
    labels.quartiere ? `in zona ${labels.quartiere}` : '',
  ].filter(Boolean).join(' ');

  const metaDescription = [
    'Consulta i lavori pubblicati in questa zona, guarda la mappa degli interventi simili e apri le schede degli artigiani che li hanno realizzati.',
    labels.citta ? `Area: ${labels.citta}` : '',
    labels.quartiere ? `Zona: ${labels.quartiere}` : '',
  ].filter(Boolean).join(' ');

  const breadcrumbs = [
    { label: 'Home', href: '/' },
  ];
  if (interventoSlug) breadcrumbs.push({ label: labels.intervento, href: `/${interventoSlug}` });
  if (categoriaSlug && interventoSlug) breadcrumbs.push({ label: labels.categoria, href: `/${categoriaSlug}/${interventoSlug}` });
  if (categoriaSlug && interventoSlug && cittaSlug) breadcrumbs.push({ label: labels.citta, href: `/${categoriaSlug}/${interventoSlug}/${cittaSlug}` });
  if (categoriaSlug && interventoSlug && cittaSlug && quartiereSlug) breadcrumbs.push({ label: labels.quartiere, href: `/${categoriaSlug}/${interventoSlug}/${cittaSlug}/${quartiereSlug}` });

  return {
    filters: {
      categoriaSlug,
      interventoSlug,
      cittaSlug,
      quartiereSlug,
    },
    labels,
    pageTitle,
    intro,
    metaDescription,
    breadcrumbs,
    lavori,
  };
}

async function getCategoryWorksDirectory(pool, filters) {
  const allWorks = await listWorksForSeo(pool);
  const categoriaSlug = normalizeSlug(filters.categoriaSlug);
  const cittaSlug = normalizeSlug(filters.citta);
  const quartiereSlug = normalizeSlug(filters.quartiere);
  const interventoSlug = normalizeSlug(filters.intervento);

  const categoryWorks = allWorks
    .map(enrichAnyJob)
    .filter((lavoro) => normalizeSlug(lavoro.categoria_slug || lavoro.categoria_nome) === categoriaSlug);

  const availableInterventi = Array.from(new Map(
    categoryWorks
      .filter((lavoro) => !cittaSlug || normalizeSlug(lavoro.citta) === cittaSlug)
      .map((lavoro) => [compactInterventoSlug(lavoro.tipo_nome || lavoro.titolo), {
        slug: compactInterventoSlug(lavoro.tipo_nome || lavoro.titolo),
        label: lavoro.tipo_nome || lavoro.titolo,
      }])
  ).values()).sort((a, b) => a.label.localeCompare(b.label, 'it'));

  const lavori = categoryWorks.filter((lavoro) => {
    if (cittaSlug && normalizeSlug(lavoro.citta) !== cittaSlug) return false;
    if (quartiereSlug && normalizeSlug(lavoro.quartiere) !== quartiereSlug) return false;
    if (interventoSlug && compactInterventoSlug(lavoro.tipo_nome || lavoro.titolo) !== interventoSlug) return false;
    return true;
  });

  return {
    lavori: lavori.slice(0, 60),
    availableInterventi,
  };
}

async function getSeoWorkDetail(pool, filters) {
  const allWorks = await listWorksForSeo(pool);
  const categoriaSlug = normalizeSlug(filters.categoriaSlug);
  const interventoSlug = normalizeSlug(filters.interventoSlug);
  const cittaSlug = normalizeSlug(filters.cittaSlug);
  const quartiereSlug = normalizeSlug(filters.quartiereSlug);
  const artigianoSlug = normalizeSlug(filters.artigianoSlug);
  const lavoroSlug = normalizeSlug(filters.lavoroSlug);

  return allWorks.find((lavoro) =>
    normalizeSlug(lavoro.categoria_slug) === categoriaSlug &&
    compactInterventoSlug(lavoro.tipo_nome || lavoro.titolo) === interventoSlug &&
    normalizeSlug(lavoro.seo_citta_slug || lavoro.citta) === cittaSlug &&
    normalizeSlug(lavoro.seo_quartiere_slug || lavoro.quartiere) === quartiereSlug &&
    normalizeSlug(lavoro.artigiano_slug) === artigianoSlug &&
    normalizeSlug(lavoro.slug) === lavoroSlug
  ) || null;
}

async function getWorkDetailByPublicPath(pool, filters) {
  const allWorks = await listWorksForSeo(pool);
  const normalizedCategory = normalizeSlug(filters.categoriaSlug);
  const normalizedIntervento = normalizeSlug(filters.interventoSlug);
  const normalizedCitta = normalizeSlug(filters.cittaSlug);
  const normalizedQuartiere = normalizeSlug(filters.quartiereSlug);
  const normalizedArtigiano = normalizeSlug(filters.artigianoSlug);

  return allWorks.find((lavoro) =>
    normalizeSlug(lavoro.categoria_slug) === normalizedCategory &&
    compactInterventoSlug(lavoro.tipo_nome || lavoro.titolo) === normalizedIntervento &&
    normalizeSlug(lavoro.citta) === normalizedCitta &&
    normalizeSlug(lavoro.quartiere) === normalizedQuartiere &&
    normalizeSlug(lavoro.artigiano_slug) === normalizedArtigiano
  ) || null;
}

async function getWorkDetailBySlug(pool, lavoroSlug) {
  const allWorks = await listWorksForSeo(pool);
  const normalized = normalizeSlug(lavoroSlug);
  return allWorks.find((lavoro) => normalizeSlug(lavoro.slug) === normalized) || null;
}

module.exports = {
  getLatestWorks,
  searchSimilarWorks,
  listWorksForSeo,
  resolveSearchIntent,
  scoreTextAgainstIntent,
  scoreWorkAgainstIntent,
  getSeoWorksPage,
  getCategoryWorksDirectory,
  getSeoWorkDetail,
  getWorkDetailByPublicPath,
  getWorkDetailBySlug,
  buildSeoWorkPath,
  compactInterventoSlug,
  buildPublicWorkPath,
};
