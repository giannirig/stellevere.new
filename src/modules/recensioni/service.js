const { listLatestRecensioni, listRecensioniByLavoroId, createRecensioneForLavoro } = require('../../repositories/recensioni-repo');
const { findLavoroByArtigianoAndSlug } = require('../../repositories/lavori-repo');
const { listLegacyRecensioni, getLegacyArtigianoProfile } = require('../../data/legacy-store');
const { findLocalDashboardJob, addLocalJobReview } = require('../../data/dashboard-jobs-store');

async function getLatestReviews(pool) {
  try {
    const recensioni = await listLatestRecensioni(pool);
    if (recensioni.length) return recensioni;
  } catch (_) {}
  return listLegacyRecensioni();
}

async function getReviewTarget(pool, artigianoSlug, lavoroSlug) {
  if (pool) {
    try {
      const lavoro = await findLavoroByArtigianoAndSlug(pool, artigianoSlug, lavoroSlug);
      if (lavoro) return lavoro;
    } catch (_) {}
  }
  const localJob = findLocalDashboardJob(artigianoSlug, lavoroSlug);
  if (!localJob) return null;
  return {
    ...localJob,
    artigiano_id: artigianoSlug,
    artigiano_slug: artigianoSlug,
    artigiano_nome: artigianoSlug,
  };
}

async function submitWorkReview(pool, artigianoSlug, lavoroSlug, payload) {
  const clienteNome = String(payload.cliente_nome || '').trim();
  const testo = String(payload.testo || '').trim();
  const voto = Number(payload.voto || 0);

  if (clienteNome.length < 2) return { ok: false, message: 'Inserisci il tuo nome.' };
  if (!Number.isFinite(voto) || voto < 1 || voto > 5) return { ok: false, message: 'Seleziona un voto da 1 a 5.' };
  if (testo.length < 10) return { ok: false, message: 'Scrivi una recensione di almeno 10 caratteri.' };

  const target = await getReviewTarget(pool, artigianoSlug, lavoroSlug);
  if (!target) return { ok: false, message: 'Lavoro non trovato.' };

  if (pool && Number.isFinite(Number(target.id)) && Number.isFinite(Number(target.artigiano_id))) {
    try {
      await createRecensioneForLavoro(pool, {
        lavoroId: target.id,
        artigianoId: target.artigiano_id,
        clienteNome,
        voto,
        testo,
      });
      return { ok: true };
    } catch (_) {}
  }

  const localResult = addLocalJobReview(artigianoSlug, lavoroSlug, {
    cliente_nome: clienteNome,
    voto,
    testo,
  });
  return localResult ? { ok: true } : { ok: false, message: 'Non sono riuscito a salvare la recensione.' };
}

async function getReviewsForWork(pool, artigianoSlug, lavoroSlug) {
  const target = await getReviewTarget(pool, artigianoSlug, lavoroSlug);
  if (!target) return [];

  if (pool && Number.isFinite(Number(target.id))) {
    try {
      const recensioni = await listRecensioniByLavoroId(pool, Number(target.id), 20);
      if (recensioni.length) return recensioni;
    } catch (_) {}
  }

  const localJob = findLocalDashboardJob(artigianoSlug, lavoroSlug);
  if (localJob && Array.isArray(localJob.recensioni) && localJob.recensioni.length) {
    return localJob.recensioni;
  }

  const legacyProfile = getLegacyArtigianoProfile(artigianoSlug);
  const legacyJob = legacyProfile && Array.isArray(legacyProfile.lavori)
    ? legacyProfile.lavori.find((job) => String(job.slug || '').trim() === String(lavoroSlug || '').trim())
    : null;

  if (legacyJob && legacyJob.recensione && legacyJob.cliente) {
    return [{
      id: `${artigianoSlug}-${lavoroSlug}-legacy`,
      cliente_nome: legacyJob.cliente,
      voto: Number(legacyJob.stelle || 5),
      testo: legacyJob.recensione,
      data_recensione: legacyJob.data_recensione || legacyJob.data || '',
    }];
  }

  return [];
}

module.exports = {
  getLatestReviews,
  getReviewTarget,
  submitWorkReview,
  getReviewsForWork,
};
