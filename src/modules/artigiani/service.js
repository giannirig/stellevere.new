const {
  listArtigiani,
  findArtigianoBySlug,
  listArtigianoWorks,
} = require('../../repositories/artigiani-repo');
const {
  listLegacyArtigiani,
  getLegacyArtigianoProfile,
  listLegacyLavori,
} = require('../../data/legacy-store');
const { getProfileOverrides, buildAddressString, parseAddress, buildHours } = require('../../data/dashboard-store');
const { listLocalDashboardJobs, listAllLocalDashboardJobs } = require('../../data/dashboard-jobs-store');
const { detectPhoneType, phoneTypeLabel, formatDisplayPhone } = require('../../services/phone-service');
const { buildPublicWorkPath } = require('../lavori/service');

const CATEGORY_ALIASES = {
  idraulici: 'idraulica',
  idraulico: 'idraulica',
  idraulica: 'idraulica',
  elettricisti: 'elettricista',
  elettricista: 'elettricista',
  imbianchini: 'imbianchino',
  imbianchino: 'imbianchino',
  falegnami: 'falegname',
  falegname: 'falegname',
  muratori: 'muratore',
  muratore: 'muratore',
  climatizzazione: 'climatizzazione',
  climatizzatori: 'climatizzazione',
  condizionatori: 'climatizzazione',
  caldaie: 'caldaie',
  serramentisti: 'serramentista',
  serramentista: 'serramentista',
  fabbri: 'fabbro',
  fabbro: 'fabbro',
  giardinieri: 'giardiniere',
  giardiniere: 'giardiniere',
};

const CATEGORY_LABELS = {
  idraulica: 'Idraulici',
  elettricista: 'Elettricisti',
  imbianchino: 'Imbianchini',
  falegname: 'Falegnami',
  muratore: 'Muratori',
  climatizzazione: 'Climatizzazione',
  caldaie: 'Caldaie',
  serramentista: 'Serramentisti',
  fabbro: 'Fabbri',
  giardiniere: 'Giardinieri',
};

const CITY_LOCATION_LOOKUP = {
  alessandria: { region: 'Piemonte', province: 'Alessandria', lat: 44.9128, lng: 8.6157 },
  ancona: { region: 'Marche', province: 'Ancona', lat: 43.6158, lng: 13.5189 },
  bergamo: { region: 'Lombardia', province: 'Bergamo', lat: 45.6983, lng: 9.6773 },
  brescia: { region: 'Lombardia', province: 'Brescia', lat: 45.5416, lng: 10.2118 },
  como: { region: 'Lombardia', province: 'Como', lat: 45.8081, lng: 9.0852 },
  roma: { region: 'Lazio', province: 'Roma', lat: 41.9028, lng: 12.4964 },
  milano: { region: 'Lombardia', province: 'Milano', lat: 45.4642, lng: 9.19 },
  torino: { region: 'Piemonte', province: 'Torino', lat: 45.0703, lng: 7.6869 },
  napoli: { region: 'Campania', province: 'Napoli', lat: 40.8518, lng: 14.2681 },
  bologna: { region: 'Emilia-Romagna', province: 'Bologna', lat: 44.4949, lng: 11.3426 },
  firenze: { region: 'Toscana', province: 'Firenze', lat: 43.7696, lng: 11.2558 },
  livorno: { region: 'Toscana', province: 'Livorno', lat: 43.5485, lng: 10.3106 },
  rimini: { region: 'Emilia-Romagna', province: 'Rimini', lat: 44.0678, lng: 12.5695 },
  modena: { region: 'Emilia-Romagna', province: 'Modena', lat: 44.6471, lng: 10.9252 },
  monza: { region: 'Lombardia', province: 'Monza e Brianza', lat: 45.5845, lng: 9.2744 },
  novara: { region: 'Piemonte', province: 'Novara', lat: 45.445, lng: 8.6218 },
  parma: { region: 'Emilia-Romagna', province: 'Parma', lat: 44.8015, lng: 10.3279 },
  perugia: { region: 'Umbria', province: 'Perugia', lat: 43.1107, lng: 12.3908 },
  pisa: { region: 'Toscana', province: 'Pisa', lat: 43.7169, lng: 10.3966 },
  'reggio emilia': { region: 'Emilia-Romagna', province: 'Reggio Emilia', lat: 44.6983, lng: 10.6312 },
  treviso: { region: 'Veneto', province: 'Treviso', lat: 45.6669, lng: 12.243 },
  lucca: { region: 'Toscana', province: 'Lucca', lat: 43.8429, lng: 10.5027 },
  varese: { region: 'Lombardia', province: 'Varese', lat: 45.8206, lng: 8.825 },
  verona: { region: 'Veneto', province: 'Verona', lat: 45.4384, lng: 10.9916 },
  vicenza: { region: 'Veneto', province: 'Vicenza', lat: 45.5455, lng: 11.5354 },
  'reggio calabria': { region: 'Calabria', province: 'Reggio Calabria', lat: 38.1113, lng: 15.6473 },
  bari: { region: 'Puglia', province: 'Bari', lat: 41.1171, lng: 16.8719 },
  genova: { region: 'Liguria', province: 'Genova', lat: 44.4056, lng: 8.9463 },
  venezia: { region: 'Veneto', province: 'Venezia', lat: 45.4408, lng: 12.3155 },
  padova: { region: 'Veneto', province: 'Padova', lat: 45.4064, lng: 11.8768 },
  palermo: { region: 'Sicilia', province: 'Palermo', lat: 38.1157, lng: 13.3615 },
  catania: { region: 'Sicilia', province: 'Catania', lat: 37.5079, lng: 15.083 },
};

function normalizeCategorySlug(value) {
  return CATEGORY_ALIASES[String(value || '').trim().toLowerCase()] || String(value || '').trim().toLowerCase();
}

function getLocationMeta(city) {
  return CITY_LOCATION_LOOKUP[String(city || '').trim().toLowerCase()] || null;
}

function getRegionFromCity(city) {
  return (getLocationMeta(city) || {}).region || 'Altre zone';
}

function getProvinceFromCity(city) {
  return (getLocationMeta(city) || {}).province || 'Altre province';
}

function derivePlanFromJobCount(jobCount) {
  if (jobCount > 25) return { slug: 'unlimited', nome: 'Unlimited' };
  if (jobCount > 10) return { slug: 'pro', nome: 'Pro' };
  if (jobCount > 5) return { slug: 'base', nome: 'Base' };
  return { slug: 'free', nome: 'Free' };
}

function getPlanPriority(artigiano) {
  const slug = String((artigiano.public_plan && artigiano.public_plan.slug) || artigiano.plan_slug || '').toLowerCase();
  if (slug === 'unlimited') return 4;
  if (slug === 'pro') return 3;
  if (slug === 'base') return 2;
  return 1;
}

function getProximityPriority(artigiano, filters = {}) {
  const region = String(filters.regione || '').trim().toLowerCase();
  const province = String(filters.provincia || '').trim().toLowerCase();
  const city = String(filters.citta || '').trim().toLowerCase();
  const quartiere = String(filters.quartiere || '').trim().toLowerCase();

  const artigianoCity = String(artigiano.citta_principale || '').trim().toLowerCase();
  const artigianoQuartiere = String(artigiano.quartiere_principale || '').trim().toLowerCase();
  const artigianoRegion = getRegionFromCity(artigiano.citta_principale).toLowerCase();
  const artigianoProvince = getProvinceFromCity(artigiano.citta_principale).toLowerCase();

  if (quartiere && city && artigianoCity === city && artigianoQuartiere && artigianoQuartiere === quartiere) return 5;
  if (city && artigianoCity === city) return 4;
  if (province && artigianoProvince === province) return 3;
  if (region && artigianoRegion === region) return 2;
  if (!region && !province && !city && !quartiere) return 1;
  return 0;
}

function trimAddressForPublicProfile(fullAddress, city, claimStatus) {
  const value = String(fullAddress || '').trim();
  if (!value) return '';
  if (claimStatus === 'claimed') return value;

  const normalizedCity = String(city || '').trim();
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return normalizedCity && value.toLowerCase() === normalizedCity.toLowerCase() ? '' : value;
  }

  const lastPart = parts[parts.length - 1];
  if (normalizedCity && lastPart.toLowerCase().includes(normalizedCity.toLowerCase())) {
    parts.pop();
  }
  return parts.join(', ');
}

function enrichArtigiano(artigiano) {
  if (!artigiano) return null;
  const overrides = artigiano.slug ? getProfileOverrides(artigiano.slug) : {};
  const parsedAddress = parseAddress(overrides.sede_legale || artigiano.sede_legale || '');
  const phoneType = detectPhoneType(artigiano.telefono);
  const plan = artigiano.plan_slug
    ? { slug: artigiano.plan_slug, nome: artigiano.plan_nome || artigiano.plan_slug }
    : derivePlanFromJobCount(Number(artigiano.jobs_count || 0));
  return {
    ...artigiano,
    citta_principale: parsedAddress.citta || artigiano.citta_principale,
    telefono: formatDisplayPhone(overrides.telefono || artigiano.telefono),
    descrizione_attivita: String(overrides.descrizione_attivita || artigiano.descrizione_attivita || artigiano.bio || '').trim(),
    hours: buildHours(overrides.hours || artigiano.hours),
    phone_type: phoneType,
    phone_type_label: phoneTypeLabel(phoneType),
    public_plan: plan,
    call_enabled: plan.slug !== 'free',
  };
}

async function getDirectoryOverview(pool) {
  try {
    const artigiani = await listArtigiani(pool);
    if (artigiani.length) return artigiani.map(enrichArtigiano);
  } catch (_) {}
  return listLegacyArtigiani().map(enrichArtigiano);
}

async function getPublicArtisanProfile(pool, slug) {
  try {
    const artigiano = await findArtigianoBySlug(pool, slug);
    if (artigiano) {
      const lavori = (await listArtigianoWorks(pool, artigiano.id)).map((lavoro) => ({
        ...lavoro,
        detail_path: buildPublicWorkPath(lavoro),
      }));
      return {
        artigiano: enrichArtigiano({
          ...artigiano,
          jobs_count: lavori.length,
          indirizzo_completo: trimAddressForPublicProfile(artigiano.sede_legale || '', artigiano.citta_principale, artigiano.claim_status),
        }),
        lavori,
      };
    }
  } catch (_) {}

  const legacyProfile = getLegacyArtigianoProfile(slug);
  if (!legacyProfile) return null;

  const localJobs = listLocalDashboardJobs(slug).map((job) => ({
    ...job,
    artigiano_slug: slug,
    cover_path: job.cover_path || '',
    cover_alt: job.cover_alt || job.titolo,
    immagini: Array.isArray(job.immagini)
      ? job.immagini.map((image, index) => ({
          src: image.src || '',
          alt: image.name || `${job.titolo} ${index + 1}`,
        }))
      : [],
    detail_path: buildPublicWorkPath({
      ...job,
      artigiano_slug: slug,
    }),
  }));

  const legacyPublicJobs = (legacyProfile.lavori || [])
    .filter((job) => !job.is_example)
    .map((job) => ({
      ...job,
      detail_path: buildPublicWorkPath(job),
    }));

  const lavori = [...localJobs, ...legacyPublicJobs];

  const reviewsCount = lavori.reduce((sum, item) => sum + Number(item.reviews_count || (Array.isArray(item.recensioni) ? item.recensioni.length : 0) || 0), 0);
  const weightedRatings = lavori.reduce((sum, item) => {
    const count = Number(item.reviews_count || (Array.isArray(item.recensioni) ? item.recensioni.length : 0) || 0);
    const rating = Number(item.rating_avg || 0);
    return sum + (count > 0 ? rating * count : 0);
  }, 0);
  const ratingAvg = reviewsCount ? Number((weightedRatings / reviewsCount).toFixed(1)) : 0;

  const overrides = getProfileOverrides(slug);
  const indirizzoCompleto = buildAddressString(
    overrides.sede_legale
      ? parseAddress(overrides.sede_legale)
      : {
          indirizzo_via: legacyProfile.artigiano.citta_principale || '',
          indirizzo_cap: '',
          indirizzo_provincia: '',
        }
  );

  return {
    ...legacyProfile,
    lavori,
    artigiano: enrichArtigiano({
      ...legacyProfile.artigiano,
      claim_status: overrides.claim_status || legacyProfile.artigiano.claim_status,
      jobs_count: lavori.filter((item) => !item.is_example).length,
      reviews_count: reviewsCount,
      rating_avg: ratingAvg,
      indirizzo_completo: trimAddressForPublicProfile(indirizzoCompleto, legacyProfile.artigiano.citta_principale, legacyProfile.artigiano.claim_status),
    }),
  };
}

async function getCategoryDirectoryPage(pool, categoriaSlug, filters = {}) {
  const normalizedCategory = normalizeCategorySlug(categoriaSlug);
  const allArtigiani = await getDirectoryOverview(pool);
  const allWorks = [
    ...listLegacyLavori(5000),
    ...listAllLocalDashboardJobs(),
  ];

  const artigiani = allArtigiani.filter((artigiano) => {
    const category = normalizeCategorySlug(artigiano.categoria_slug || artigiano.categoria_nome);
    return category === normalizedCategory;
  });

  if (!artigiani.length) return null;

  const selectedRegion = String(filters.regione || '').trim();
  const selectedProvince = String(filters.provincia || '').trim();
  const selectedCity = String(filters.citta || '').trim();
  const selectedQuartiere = String(filters.quartiere || '').trim();

  const cityGroups = new Map();
  artigiani.forEach((artigiano) => {
    const city = String(artigiano.citta_principale || 'Città da completare').trim();
    const region = getRegionFromCity(city);
    const province = getProvinceFromCity(city);
    const key = `${region}__${province}__${city}`;
    if (!cityGroups.has(key)) {
      cityGroups.set(key, {
        region,
        province,
        city,
        coords: getLocationMeta(city),
        quartieriSet: new Set(),
        artigiani: [],
      });
    }

    const group = cityGroups.get(key);
    group.artigiani.push(artigiano);

    allWorks.forEach((work) => {
      const workCategory = normalizeCategorySlug(work.categoria_slug || work.categoria_nome);
      if (workCategory !== normalizedCategory) return;
      if (String(work.artigiano_slug || '').toLowerCase() !== String(artigiano.slug || '').toLowerCase()) return;
      if (String(work.citta || '').trim().toLowerCase() !== city.toLowerCase()) return;
      if (String(work.quartiere || '').trim()) {
        group.quartieriSet.add(String(work.quartiere).trim());
      }
    });
  });

  const regionsMap = new Map();
  Array.from(cityGroups.values())
    .sort((a, b) => a.city.localeCompare(b.city, 'it'))
    .forEach((group) => {
      if (!regionsMap.has(group.region)) {
        regionsMap.set(group.region, {
          nome: group.region,
          provincesMap: new Map(),
        });
      }

      const regionEntry = regionsMap.get(group.region);
      if (!regionEntry.provincesMap.has(group.province)) {
        regionEntry.provincesMap.set(group.province, {
          nome: group.province,
          cities: [],
        });
      }

      regionEntry.provincesMap.get(group.province).cities.push({
        nome: group.city,
        provincia: group.province,
        coords: group.coords,
        quartieri: Array.from(group.quartieriSet).sort((a, b) => a.localeCompare(b, 'it')),
        artigiani: group.artigiani.sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
      });
    });

  const regions = Array.from(regionsMap.values())
    .map((region) => ({
      nome: region.nome,
      provinces: Array.from(region.provincesMap.values())
        .map((province) => ({
          nome: province.nome,
          cities: province.cities.sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  const availableRegions = regions.map((region) => region.nome);
  const availableProvinces = Array.from(new Set(
    regions
      .filter((region) => !selectedRegion || region.nome.toLowerCase() === selectedRegion.toLowerCase())
      .flatMap((region) => region.provinces.map((province) => province.nome))
  )).sort((a, b) => a.localeCompare(b, 'it'));
  const availableCities = Array.from(new Set(
    regions
      .filter((region) => !selectedRegion || region.nome.toLowerCase() === selectedRegion.toLowerCase())
      .flatMap((region) => region.provinces)
      .filter((province) => !selectedProvince || province.nome.toLowerCase() === selectedProvince.toLowerCase())
      .flatMap((province) => province.cities.map((city) => city.nome))
  )).sort((a, b) => a.localeCompare(b, 'it'));
  const availableQuartieri = Array.from(new Set(
    regions
      .filter((region) => !selectedRegion || region.nome.toLowerCase() === selectedRegion.toLowerCase())
      .flatMap((region) => region.provinces)
      .filter((province) => !selectedProvince || province.nome.toLowerCase() === selectedProvince.toLowerCase())
      .flatMap((province) => province.cities)
      .filter((city) => !selectedCity || city.nome.toLowerCase() === selectedCity.toLowerCase())
      .flatMap((city) => city.quartieri)
  )).sort((a, b) => a.localeCompare(b, 'it'));

  const featuredCities = [];
  const filteredRegions = [];
  regions.forEach((region) => {
    const regionMatch = !selectedRegion || region.nome.toLowerCase() === selectedRegion.toLowerCase();
    if (!regionMatch && selectedRegion) return;

    const provinceEntries = [];
    region.provinces.forEach((province) => {
      const provinceMatch = !selectedProvince || province.nome.toLowerCase() === selectedProvince.toLowerCase();
      if (!provinceMatch && selectedProvince) return;

      const matchingCities = province.cities.filter((city) => {
        const cityMatch = !selectedCity || city.nome.toLowerCase() === selectedCity.toLowerCase();
        const quartiereMatch = !selectedQuartiere || city.quartieri.some((quartiere) => quartiere.toLowerCase() === selectedQuartiere.toLowerCase());
        return cityMatch && quartiereMatch;
      });

      if (matchingCities.length) {
        matchingCities.forEach((city) => featuredCities.push({
          region: region.nome,
          province: province.nome,
          ...city,
        }));
      }

      if (!selectedRegion && !selectedProvince && !selectedCity && !selectedQuartiere) {
        provinceEntries.push(province);
        return;
      }

      const remainingCities = province.cities.filter((city) => !matchingCities.includes(city));
      if (remainingCities.length) {
        provinceEntries.push({
          ...province,
          cities: remainingCities,
        });
      }
    });

    if (provinceEntries.length) {
      filteredRegions.push({
        ...region,
        provinces: provinceEntries,
      });
    }
  });

  const featuredArtigiani = artigiani
    .map((artigiano) => ({
      ...artigiano,
      proximity_priority: getProximityPriority(artigiano, filters),
      plan_priority: getPlanPriority(artigiano),
      region_label: getRegionFromCity(artigiano.citta_principale),
      province_label: getProvinceFromCity(artigiano.citta_principale),
    }))
    .sort((a, b) => {
      if (b.proximity_priority !== a.proximity_priority) return b.proximity_priority - a.proximity_priority;
      if (b.plan_priority !== a.plan_priority) return b.plan_priority - a.plan_priority;
      if (Number(b.rating_avg || 0) !== Number(a.rating_avg || 0)) return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
      if (Number(b.reviews_count || 0) !== Number(a.reviews_count || 0)) return Number(b.reviews_count || 0) - Number(a.reviews_count || 0);
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'it');
    })
    .slice(0, 6);

  return {
    categoriaSlug: normalizedCategory,
    categoriaLabel: CATEGORY_LABELS[normalizedCategory] || categoriaSlug,
    pageTitle: `${CATEGORY_LABELS[normalizedCategory] || categoriaSlug} | StelleVere`,
    regions: filteredRegions,
    featuredCities,
    featuredArtigiani,
    filters: {
      regione: selectedRegion,
      provincia: selectedProvince,
      citta: selectedCity,
      quartiere: selectedQuartiere,
    },
    availableRegions,
    availableProvinces,
    availableCities,
    availableQuartieri,
    totalArtigiani: artigiani.length,
  };
}

module.exports = {
  getDirectoryOverview,
  getPublicArtisanProfile,
  getCategoryDirectoryPage,
};
