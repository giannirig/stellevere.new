async function listArtigiani(pool) {
  if (!pool) return [];
  const [rows] = await pool.query(`
    SELECT a.*, c.nome AS categoria_nome, c.slug AS categoria_slug
    FROM artigiani a
    JOIN categorie c ON c.id = a.categoria_principale_id
    ORDER BY a.nome ASC
  `);
  return rows;
}

async function findArtigianoBySlug(pool, slug) {
  if (!pool) return null;
  const [rows] = await pool.query(`
    SELECT a.*, c.nome AS categoria_nome, c.slug AS categoria_slug
    FROM artigiani a
    JOIN categorie c ON c.id = a.categoria_principale_id
    WHERE a.slug = ?
    LIMIT 1
  `, [slug]);
  return rows[0] || null;
}

async function listArtigianoWorks(pool, artigianoId, limit = 24) {
  if (!pool) return [];
  const [rows] = await pool.query(`
    SELECT
      l.id,
      l.slug,
      l.titolo,
      l.descrizione,
      l.citta,
      l.quartiere,
      l.rating_avg,
      l.reviews_count,
      l.published_at,
      c.slug AS categoria_slug,
      c.nome AS categoria_nome,
      t.slug AS tipo_slug,
      t.nome AS tipo_nome,
      cover.file_path AS cover_path,
      cover.alt_text AS cover_alt
    FROM lavori l
    JOIN categorie c ON c.id = l.categoria_id
    JOIN tipi_intervento t ON t.id = l.tipo_intervento_id
    LEFT JOIN lavoro_immagini cover ON cover.id = l.cover_image_id
    WHERE l.artigiano_id = ?
      AND l.stato_pubblicazione = 'published'
    ORDER BY l.published_at DESC
    LIMIT ?
  `, [artigianoId, limit]);
  return rows;
}

async function updateArtigianoProfileBySlug(pool, slug, payload) {
  if (!pool) return null;
  await pool.query(`
    UPDATE artigiani
    SET nome = ?,
        telefono = ?,
        sede_legale = ?,
        orari_lavoro = ?,
        sito_web = ?,
        facebook_url = ?,
        instagram_url = ?,
        tiktok_url = ?
    WHERE slug = ?
  `, [
    payload.nome,
    payload.telefono,
    payload.sede_legale,
    payload.orari_lavoro,
    payload.sito_web,
    payload.facebook_url,
    payload.instagram_url,
    payload.tiktok_url,
    slug,
  ]);

  return findArtigianoBySlug(pool, slug);
}

module.exports = {
  listArtigiani,
  findArtigianoBySlug,
  listArtigianoWorks,
  updateArtigianoProfileBySlug,
};
