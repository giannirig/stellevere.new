const fs = require('fs');
const path = require('path');
const { slugify } = require('../services/slug-service');

const DATA_DIR = path.join(process.cwd(), 'data');
const DASHBOARD_JOBS_PATH = path.join(DATA_DIR, 'dashboard-jobs.json');

function loadJobsState() {
  try {
    return JSON.parse(fs.readFileSync(DASHBOARD_JOBS_PATH, 'utf8'));
  } catch (_) {
    return { jobsByArtigiano: {} };
  }
}

function saveJobsState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DASHBOARD_JOBS_PATH, JSON.stringify(state, null, 2));
}

const jobsState = loadJobsState();

function listLocalDashboardJobs(slug) {
  return jobsState.jobsByArtigiano[slug] || [];
}

function listAllLocalDashboardJobs() {
  return Object.entries(jobsState.jobsByArtigiano).flatMap(([artigianoSlug, jobs]) =>
    (jobs || []).map((job) => ({
      ...job,
      artigiano_slug: artigianoSlug,
    }))
  );
}

function findLocalDashboardJob(slug, jobSlug) {
  return listLocalDashboardJobs(slug).find((job) => job.slug === jobSlug) || null;
}

function addLocalDashboardJob(slug, payload) {
  if (!jobsState.jobsByArtigiano[slug]) {
    jobsState.jobsByArtigiano[slug] = [];
  }

  const currentJobs = jobsState.jobsByArtigiano[slug];
  const nextId = currentJobs.reduce((max, job) => Math.max(max, Number(job.id) || 0), 0) + 1;
  const now = new Date().toISOString();

  const job = {
    id: nextId,
    slug: slugify(`${payload.titolo}-${payload.citta}-${Date.now()}`),
    titolo: String(payload.titolo || '').trim(),
    descrizione: String(payload.descrizione || '').trim(),
    citta: String(payload.citta || '').trim(),
    quartiere: String(payload.quartiere || '').trim(),
    lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : null,
    lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : null,
    categoria_slug: String(payload.categoria_slug || '').trim(),
    categoria_nome: String(payload.categoria_nome || '').trim(),
    tipo_slug: String(payload.tipo_slug || '').trim(),
    tipo_nome: String(payload.tipo_nome || '').trim(),
    cliente_whatsapp: String(payload.cliente_whatsapp || '').trim(),
    rating_avg: 0,
    reviews_count: 0,
    published_at: now,
    cover_path: Array.isArray(payload.immagini) && payload.immagini[0] ? payload.immagini[0].src : '',
    cover_alt: Array.isArray(payload.immagini) && payload.immagini[0] ? payload.immagini[0].name : '',
    immagini: Array.isArray(payload.immagini) ? payload.immagini : [],
    recensioni: [],
  };

  currentJobs.unshift(job);
  saveJobsState(jobsState);
  return job;
}

function updateLocalDashboardJob(slug, jobSlug, payload) {
  const job = findLocalDashboardJob(slug, jobSlug);
  if (!job) return null;

  job.titolo = String(payload.titolo || '').trim();
  job.descrizione = String(payload.descrizione || '').trim();
  job.citta = String(payload.citta || '').trim();
  job.quartiere = String(payload.quartiere || '').trim();
  job.lat = Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : null;
  job.lng = Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : null;
  job.categoria_slug = String(payload.categoria_slug || '').trim();
  job.categoria_nome = String(payload.categoria_nome || '').trim();
  job.tipo_slug = String(payload.tipo_slug || '').trim();
  job.tipo_nome = String(payload.tipo_nome || '').trim();
  job.cliente_whatsapp = String(payload.cliente_whatsapp || '').trim();
  job.immagini = Array.isArray(payload.immagini) ? payload.immagini : [];
  job.cover_path = job.immagini[0] ? job.immagini[0].src : '';
  job.cover_alt = job.immagini[0] ? job.immagini[0].name : '';

  saveJobsState(jobsState);
  return job;
}

function addLocalJobReview(slug, jobSlug, payload) {
  const job = findLocalDashboardJob(slug, jobSlug);
  if (!job) return null;

  const review = {
    id: `${job.id}-${Date.now()}`,
    cliente_nome: String(payload.cliente_nome || '').trim(),
    voto: Number(payload.voto || 0),
    testo: String(payload.testo || '').trim(),
    data_recensione: new Date().toISOString(),
  };

  if (!Array.isArray(job.recensioni)) {
    job.recensioni = [];
  }
  job.recensioni.unshift(review);
  job.reviews_count = job.recensioni.length;
  const total = job.recensioni.reduce((sum, item) => sum + Number(item.voto || 0), 0);
  job.rating_avg = job.recensioni.length ? Number((total / job.recensioni.length).toFixed(1)) : 0;
  saveJobsState(jobsState);
  return { job, review };
}

module.exports = {
  listLocalDashboardJobs,
  listAllLocalDashboardJobs,
  findLocalDashboardJob,
  addLocalDashboardJob,
  updateLocalDashboardJob,
  addLocalJobReview,
};
