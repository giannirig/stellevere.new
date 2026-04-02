const fs = require('fs');
const path = require('path');
const { getLegacyArtigianoProfile } = require('./legacy-store');
const { listLocalDashboardJobs } = require('./dashboard-jobs-store');
const { formatDisplayPhone } = require('../services/phone-service');

const PLAN_DEFS = {
  free: { slug: 'free', nome: 'Free', prezzo: '0', maxLavori: 5 },
  base: { slug: 'base', nome: 'Base', prezzo: '9,90', maxLavori: 10 },
  pro: { slug: 'pro', nome: 'Pro', prezzo: '19,90', maxLavori: 25 },
  unlimited: { slug: 'unlimited', nome: 'Unlimited', prezzo: '39,90', maxLavori: null },
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DASHBOARD_STATE_PATH = path.join(DATA_DIR, 'dashboard-profiles.json');
const WEEK_DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function loadDashboardState() {
  try {
    return JSON.parse(fs.readFileSync(DASHBOARD_STATE_PATH, 'utf8'));
  } catch (_) {
    return { profiles: {} };
  }
}

function saveDashboardState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DASHBOARD_STATE_PATH, JSON.stringify(state, null, 2));
}

const dashboardState = loadDashboardState();

function formatHourSlot(item) {
  if (!item || item.closed) return 'Chiuso';
  const chunks = [];
  if (item.morningOpen && item.morningClose) {
    chunks.push(`${item.morningOpen} - ${item.morningClose}`);
  }
  if (item.afternoonOpen && item.afternoonClose) {
    chunks.push(`${item.afternoonOpen} - ${item.afternoonClose}`);
  }
  return chunks.length ? chunks.join(' / ') : 'Orario da definire';
}

function buildDefaultHours() {
  return WEEK_DAYS.map((day, index) => {
    if (index < 5) {
      return {
        day,
        closed: false,
        morningOpen: '08:00',
        morningClose: '12:30',
        afternoonOpen: '14:30',
        afternoonClose: '18:30',
        display: '08:00 - 12:30 / 14:30 - 18:30',
      };
    }
    if (index === 5) {
      return {
        day,
        closed: false,
        morningOpen: '08:00',
        morningClose: '13:00',
        afternoonOpen: '',
        afternoonClose: '',
        display: '08:00 - 13:00',
      };
    }
    return {
      day,
      closed: true,
      morningOpen: '',
      morningClose: '',
      afternoonOpen: '',
      afternoonClose: '',
      display: 'Chiuso',
    };
  });
}

function normalizeHourItem(day, source) {
  const item = {
    day,
    closed: Boolean(source && source.closed),
    morningOpen: String((source && source.morningOpen) || ''),
    morningClose: String((source && source.morningClose) || ''),
    afternoonOpen: String((source && source.afternoonOpen) || ''),
    afternoonClose: String((source && source.afternoonClose) || ''),
  };
  item.display = formatHourSlot(item);
  return item;
}

function buildHours(overrides) {
  const defaults = buildDefaultHours();
  if (!Array.isArray(overrides) || !overrides.length) return defaults;

  if (typeof overrides[0] === 'string') {
    return defaults.map((item, index) => {
      const legacyValue = String(overrides[index] || '').trim();
      if (!legacyValue) return item;
      return {
        ...item,
        display: legacyValue,
      };
    });
  }

  return defaults.map((item, index) => normalizeHourItem(item.day, overrides[index] || item));
}

function parseAddress(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return { via: '', numeroCivico: '', cap: '', citta: '', provincia: '' };
  }

  const normalizedValue = value.replace(/\s*-\s*/g, ', ');
  const commaParts = normalizedValue.split(',').map((part) => part.trim()).filter(Boolean);
  const streetPart = commaParts.shift() || value;
  const tailParts = [...commaParts];

  let via = streetPart;
  let numeroCivico = '';
  let cap = '';
  let citta = '';
  let provincia = '';

  const streetMatch = streetPart.match(/^(.*?)(?:\s+(\d+[A-Za-z\/-]*))?$/);
  if (streetMatch) {
    via = String(streetMatch[1] || '').trim() || streetPart;
    numeroCivico = String(streetMatch[2] || '').trim();
  }

  if (!numeroCivico && tailParts.length && /^\d+[A-Za-z\/-]*$/.test(tailParts[0])) {
    numeroCivico = tailParts.shift();
  }

  const mergedTail = tailParts.join(' ');
  const capMatch = mergedTail.match(/\b(\d{5})\b/);
  if (capMatch) {
    cap = capMatch[1];
  }

  const provinceMatch = mergedTail.match(/\b([A-Z]{2})\b$/);
  if (provinceMatch) {
    provincia = provinceMatch[1];
  }

  const citySource = mergedTail
    .replace(/\b\d{5}\b/, '')
    .replace(/\b([A-Z]{2})\b$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (citySource) {
    const cityWords = citySource.split(' ').filter(Boolean);
    citta = cityWords.filter((word, index) => cityWords.indexOf(word) === index).join(' ');
  }

  if (!citta && /^roma$/i.test(String(tailParts[0] || ''))) {
    citta = 'Roma';
  }

  if (!provincia && /^roma$/i.test(citta || String(tailParts[0] || ''))) {
    provincia = 'RM';
  }

  if (!citta && provincia) {
    citta = provincia;
  }

  return {
    via,
    numeroCivico,
    cap,
    citta,
    provincia,
  };
}

function buildAddressString(payload) {
  const rawVia = payload.indirizzo_via || payload.via || '';
  const parsedVia = parseAddress(rawVia);
  const via = String(parsedVia.via || rawVia || '').trim();
  const numeroCivico = String(parsedVia.numeroCivico || payload.indirizzo_numero_civico || payload.numeroCivico || '').trim();
  const cap = String(payload.indirizzo_cap || payload.cap || '').trim();
  const cittaRaw = String(payload.indirizzo_citta || payload.citta || payload.indirizzo_provincia || payload.provincia || '').trim();
  const citta = /^rm$/i.test(cittaRaw)
    ? 'Roma'
    : (cittaRaw ? cittaRaw.replace(/\bRM\b/i, '').trim() : '');
  const provincia = /^roma$/i.test(cittaRaw) || /^roma\b/i.test(cittaRaw)
    ? 'RM'
    : (cittaRaw.match(/\b([A-Z]{2})\b$/) || [])[1] || '';
  const street = [via, numeroCivico].filter(Boolean).join(', ');
  const locality = [cap, citta, provincia].filter(Boolean).join(' ');
  return [street, locality].filter(Boolean).join(', ');
}

function buildHoursFromPayload(payload) {
  return WEEK_DAYS.map((day, index) => {
    const prefix = `orari_${index}`;
    return normalizeHourItem(day, {
      closed: payload[`${prefix}_closed`] === 'on',
      morningOpen: payload[`${prefix}_mattina_da`],
      morningClose: payload[`${prefix}_mattina_a`],
      afternoonOpen: payload[`${prefix}_pomeriggio_da`],
      afternoonClose: payload[`${prefix}_pomeriggio_a`],
    });
  });
}

function buildPlanFromUsage(jobCount) {
  if (jobCount > 25) return PLAN_DEFS.unlimited;
  if (jobCount > 10) return PLAN_DEFS.pro;
  if (jobCount > 5) return PLAN_DEFS.base;
  return PLAN_DEFS.free;
}

function getProfileOverrides(slug) {
  return dashboardState.profiles[slug] || {};
}

function buildDashboardProfile(slug) {
  const profile = getLegacyArtigianoProfile(slug);
  if (!profile) return null;

  const overrides = getProfileOverrides(slug);
  const localJobs = listLocalDashboardJobs(slug);
  const seededJobs = Array.isArray(profile.lavori) ? profile.lavori : [];
  const seededRealJobs = seededJobs.filter((job) => !job.is_example);
  const allJobs = [...localJobs, ...seededJobs];
  const activeJobs = localJobs.length + seededRealJobs.length;
  const activePlan = buildPlanFromUsage(activeJobs);
  const websiteEnabled = Boolean(overrides.website_enabled);
  const localReviewsCount = localJobs.reduce((sum, job) => sum + Number(job.reviews_count || 0), 0);
  const localRatingWeighted = localJobs.reduce((sum, job) => sum + (Number(job.rating_avg || 0) * Number(job.reviews_count || 0)), 0);
  const legacyReviewsCount = Number(profile.artigiano.reviews_count || 0);
  const legacyRatingWeighted = Number(profile.artigiano.rating_avg || 0) * legacyReviewsCount;
  const combinedReviewsCount = legacyReviewsCount + localReviewsCount;
  const combinedAverage = combinedReviewsCount ? ((legacyRatingWeighted + localRatingWeighted) / combinedReviewsCount) : 0;

  const formattedAddress = buildAddressString(parseAddress(overrides.sede_legale || `${profile.artigiano.citta_principale || 'Milano'}`));
  const parsedFormattedAddress = parseAddress(formattedAddress);

  return {
    artigiano: {
      ...profile.artigiano,
      nome: overrides.nome || profile.artigiano.nome,
      claim_status: overrides.claim_status || profile.artigiano.claim_status,
      telefono: formatDisplayPhone(overrides.telefono || profile.artigiano.telefono),
      citta_principale: parsedFormattedAddress.citta || profile.artigiano.citta_principale,
      sede_legale: formattedAddress,
      indirizzo: parsedFormattedAddress,
      descrizione_attivita: overrides.descrizione_attivita || profile.artigiano.descrizione_attivita || '',
      website_url: overrides.website_url || '',
      facebook_url: overrides.facebook_url || '',
      instagram_url: overrides.instagram_url || '',
      tiktok_url: overrides.tiktok_url || '',
      internal_email: overrides.internal_email || '',
      hours: buildHours(overrides.hours),
    },
    lavori: allJobs,
    stats: {
      activeJobs,
      availableSlots: activePlan.maxLavori === null ? null : Math.max(activePlan.maxLavori - activeJobs, 0),
      reviewsCount: combinedReviewsCount,
      averageRating: Number(combinedAverage || 0).toFixed(1),
    },
    plans: Object.values(PLAN_DEFS),
    activePlan,
    website: {
      enabled: websiteEnabled,
      activationPrice: '299',
      includesPlan: 'Base fino a 10 lavori',
      includesDuration: '12 mesi',
      previewUrl: `/artigiano/${profile.artigiano.slug}`,
    },
  };
}

function updateDashboardProfile(slug, payload) {
  const current = getProfileOverrides(slug);
  dashboardState.profiles[slug] = {
    ...current,
    claim_status: 'claimed',
    nome: String(payload.nome || '').trim(),
    telefono: String(payload.telefono || '').trim(),
    sede_legale: buildAddressString(payload),
    descrizione_attivita: String(payload.descrizione_attivita || '').trim(),
    website_url: String(payload.website_url || '').trim(),
    facebook_url: String(payload.facebook_url || '').trim(),
    instagram_url: String(payload.instagram_url || '').trim(),
    tiktok_url: String(payload.tiktok_url || '').trim(),
    internal_email: String(payload.internal_email || '').trim(),
    hours: buildHoursFromPayload(payload),
  };
  saveDashboardState(dashboardState);
  return buildDashboardProfile(slug);
}

module.exports = {
  PLAN_DEFS,
  buildDashboardProfile,
  updateDashboardProfile,
  buildHours,
  parseAddress,
  buildAddressString,
  buildHoursFromPayload,
  getProfileOverrides,
};
