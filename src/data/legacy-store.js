const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSampleJobsForArtigiano } = require('./sample-jobs');

let legacyCache = null;
let importedCache = null;

function loadLegacyArtigiani() {
  if (legacyCache) return legacyCache;

  const serverPath = path.join(process.cwd(), 'server.js');
  const source = fs.readFileSync(serverPath, 'utf8');
  const startToken = 'const ARTIGIANI = ';
  const startIndex = source.indexOf(startToken);
  if (startIndex < 0) {
    legacyCache = {};
    return legacyCache;
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
    legacyCache = {};
    return legacyCache;
  }

  const objectLiteral = source.slice(openBraceIndex, endIndex + 1);
  const sandbox = {};
  const script = new vm.Script(`ARTIGIANI = ${objectLiteral};`);
  script.runInNewContext(sandbox);
  legacyCache = sandbox.ARTIGIANI || {};
  return legacyCache;
}

function mapLegacyArtigiano(artigiano) {
  return {
    id: artigiano.id,
    slug: artigiano.id,
    nome: artigiano.nome,
    telefono: artigiano.telefono || '',
    categoria_nome: artigiano.categoria || 'Artigiano',
    categoria_slug: artigiano.cat_slug || 'altro',
    citta_principale: artigiano.citta || '',
    quartiere_principale: '',
    bio: '',
    claim_status: 'legacy',
    rating_avg: Number(artigiano.stelle || 0),
    reviews_count: Number(artigiano.recensioni || 0),
    jobs_count: Array.isArray(artigiano.lavori) ? artigiano.lavori.length : 0,
  };
}

function loadImportedArtigiani() {
  if (importedCache) return importedCache;

  const importedPath = path.join(process.cwd(), 'data', 'imported-artigiani.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(importedPath, 'utf8'));
    importedCache = Array.isArray(parsed.artigiani) ? parsed.artigiani : [];
  } catch (_) {
    importedCache = [];
  }
  return importedCache;
}

function mapImportedArtigiano(artigiano) {
  return {
    id: artigiano.id || artigiano.slug,
    slug: artigiano.slug || artigiano.id,
    nome: artigiano.nome,
    telefono: artigiano.telefono || '',
    categoria_nome: artigiano.categoria_nome || 'Idraulica',
    categoria_slug: artigiano.categoria_slug || 'idraulica',
    citta_principale: artigiano.citta_principale || '',
    quartiere_principale: '',
    bio: '',
    claim_status: artigiano.claim_status || 'unclaimed',
    rating_avg: Number(artigiano.rating_avg || 0),
    reviews_count: Number(artigiano.reviews_count || 0),
    jobs_count: 0,
    sede_legale: artigiano.sede_legale || artigiano.citta_principale || '',
    source: artigiano.source || 'google_maps',
  };
}

function listLegacyArtigiani() {
  return [
    ...Object.values(loadLegacyArtigiani()).map(mapLegacyArtigiano),
    ...loadImportedArtigiani().map(mapImportedArtigiano),
  ]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

function getLegacyArtigianoProfile(slug) {
  const artigiano = loadLegacyArtigiani()[slug];
  if (artigiano) {
    const mappedArtigiano = mapLegacyArtigiano(artigiano);
    const lavori = (artigiano.lavori || []).map((lavoro) => ({
      id: lavoro.id,
      slug: '',
      titolo: lavoro.titolo,
      descrizione: lavoro.descrizione,
      citta: lavoro.citta || '',
      quartiere: lavoro.quartiere || '',
      rating_avg: Number(lavoro.stelle || 0),
      reviews_count: lavoro.recensione && lavoro.cliente ? 1 : 0,
      published_at: lavoro.data || '',
      categoria_slug: artigiano.cat_slug || 'altro',
      categoria_nome: artigiano.categoria || 'Artigiano',
      tipo_slug: lavoro.sottocategoria_slug || '',
      tipo_nome: lavoro.sottocategoria || lavoro.sottocategoria_slug || '',
      cover_path: Array.isArray(lavoro.immagini) && lavoro.immagini[0] ? lavoro.immagini[0].file : '',
      cover_alt: Array.isArray(lavoro.immagini) && lavoro.immagini[0] ? lavoro.immagini[0].alt : '',
    }));

    return {
      artigiano: mappedArtigiano,
      lavori,
    };
  }

  const imported = loadImportedArtigiani().find((item) => item.slug === slug);
  if (!imported) return null;

  const mappedImported = mapImportedArtigiano(imported);
  const lavoriEsempio = buildSampleJobsForArtigiano(mappedImported);
  return {
    artigiano: mappedImported,
    lavori: lavoriEsempio,
  };
}

function listLegacyLavori(limit = 12) {
  const jobs = [];
  for (const artigiano of Object.values(loadLegacyArtigiani())) {
    for (const lavoro of artigiano.lavori || []) {
      jobs.push({
        id: lavoro.id,
        slug: '',
        titolo: lavoro.titolo,
        descrizione: lavoro.descrizione || '',
        citta: lavoro.citta || '',
        quartiere: lavoro.quartiere || '',
        rating_avg: Number(lavoro.stelle || 0),
        reviews_count: lavoro.recensione && lavoro.cliente ? 1 : 0,
        published_at: lavoro.data || '',
        artigiano_slug: artigiano.id,
        artigiano_nome: artigiano.nome,
        categoria_slug: artigiano.cat_slug || 'altro',
        categoria_nome: artigiano.categoria || 'Artigiano',
        tipo_slug: lavoro.sottocategoria_slug || '',
        tipo_nome: lavoro.sottocategoria || lavoro.sottocategoria_slug || '',
        cover_path: Array.isArray(lavoro.immagini) && lavoro.immagini[0] ? lavoro.immagini[0].file : '',
        cover_alt: Array.isArray(lavoro.immagini) && lavoro.immagini[0] ? lavoro.immagini[0].alt : '',
      });
    }
  }

  return jobs.slice(0, limit);
}

function listLegacyRecensioni(limit = 10) {
  const recensioni = [];
  for (const artigiano of Object.values(loadLegacyArtigiani())) {
    for (const lavoro of artigiano.lavori || []) {
      if (!lavoro.recensione || !lavoro.cliente) continue;
      recensioni.push({
        id: `${artigiano.id}-${lavoro.id}`,
        cliente_nome: lavoro.cliente,
        voto: Number(lavoro.stelle || 5),
        testo: lavoro.recensione,
        data_recensione: lavoro.data_recensione || lavoro.data || '',
        titolo: lavoro.titolo,
      });
    }
  }

  return recensioni.slice(0, limit);
}

module.exports = {
  listLegacyArtigiani,
  getLegacyArtigianoProfile,
  listLegacyLavori,
  listLegacyRecensioni,
};
