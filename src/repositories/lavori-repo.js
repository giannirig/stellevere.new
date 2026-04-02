const fs = require('fs');
const path = require('path');
const { slugify } = require('../services/slug-service');

function parseDataUri(dataUri) {
  const match = String(dataUri || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function fileExtensionForMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function ensureUploadsDir() {
  const dir = path.join(process.cwd(), 'uploads', 'v2-lavori');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveJobImages(artSlug, jobSlug, immagini) {
  const uploadDir = ensureUploadsDir();
  return immagini.map((image, index) => {
    const parsed = parseDataUri(image.src);
    if (!parsed) return null;

    const ext = fileExtensionForMime(parsed.mimeType);
    const filename = `${artSlug}-${jobSlug}-${index + 1}.${ext}`;
    const absolutePath = path.join(uploadDir, filename);
    fs.writeFileSync(absolutePath, parsed.buffer);
    return {
      filePath: `v2-lavori/${filename}`,
      altText: image.name || `${jobSlug} ${index + 1}`,
      caption: index === 0 ? 'Copertina lavoro' : `Immagine ${index + 1}`,
      sortOrder: index,
      isCover: index === 0 ? 1 : 0,
    };
  }).filter(Boolean);
}

async function listRecentLavori(pool, limit = 12) {
  if (!pool) return [];
  const [rows] = await pool.query(`
    SELECT
      l.id,
      l.slug,
      l.titolo,
      l.citta,
      l.quartiere,
      l.rating_avg,
      l.published_at,
      a.nome AS artigiano_nome,
      c.slug AS categoria_slug,
      c.nome AS categoria_nome,
      t.slug AS tipo_slug,
      t.nome AS tipo_nome
    FROM lavori l
    JOIN artigiani a ON a.id = l.artigiano_id
    JOIN categorie c ON c.id = l.categoria_id
    JOIN tipi_intervento t ON t.id = l.tipo_intervento_id
    WHERE l.stato_pubblicazione = 'published'
    ORDER BY l.published_at DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

async function listAllPublishedLavoriForSeo(pool) {
  if (!pool) return [];
  const [rows] = await pool.query(`
    SELECT
      l.id,
      l.slug,
      l.titolo,
      l.descrizione,
      l.citta,
      l.quartiere,
      l.lat,
      l.lng,
      l.rating_avg,
      l.reviews_count,
      l.published_at,
      a.slug AS artigiano_slug,
      a.nome AS artigiano_nome,
      c.slug AS categoria_slug,
      c.nome AS categoria_nome,
      t.slug AS tipo_slug,
      t.nome AS tipo_nome,
      cover.file_path AS cover_path,
      cover.alt_text AS cover_alt
    FROM lavori l
    JOIN artigiani a ON a.id = l.artigiano_id
    JOIN categorie c ON c.id = l.categoria_id
    JOIN tipi_intervento t ON t.id = l.tipo_intervento_id
    LEFT JOIN lavoro_immagini cover ON cover.id = l.cover_image_id
    WHERE l.stato_pubblicazione = 'published'
    ORDER BY l.published_at DESC
  `);
  return rows;
}

async function findCategoriaBySlug(pool, slug) {
  if (!pool) return null;
  const [rows] = await pool.query(`
    SELECT id, slug, nome
    FROM categorie
    WHERE slug = ?
    LIMIT 1
  `, [slug]);
  return rows[0] || null;
}

async function findTipoIntervento(pool, categoriaId, slug) {
  if (!pool) return null;
  const [rows] = await pool.query(`
    SELECT id, slug, nome
    FROM tipi_intervento
    WHERE categoria_id = ?
      AND slug = ?
    LIMIT 1
  `, [categoriaId, slug]);
  return rows[0] || null;
}

async function createTipoIntervento(pool, categoriaId, nome) {
  if (!pool) return null;
  const slug = slugify(nome);
  const existing = await findTipoIntervento(pool, categoriaId, slug);
  if (existing) return existing;

  const [result] = await pool.query(`
    INSERT INTO tipi_intervento (categoria_id, slug, nome)
    VALUES (?, ?, ?)
  `, [categoriaId, slug, nome]);

  return {
    id: result.insertId,
    slug,
    nome,
  };
}

async function createLavoro(pool, payload) {
  if (!pool) return null;

  const categoria = await findCategoriaBySlug(pool, payload.categoriaSlug);
  if (!categoria) {
    throw new Error('Categoria non trovata nel database.');
  }

  const tipo = await createTipoIntervento(pool, categoria.id, payload.tipoNome);
  const slug = slugify(`${payload.titolo}-${payload.citta}-${payload.quartiere}`);
  const immaginiSalvate = saveJobImages(payload.artigianoSlug, slug, payload.immagini || []);

  const [result] = await pool.query(`
    INSERT INTO lavori (
      artigiano_id,
      categoria_id,
      tipo_intervento_id,
      slug,
      titolo,
      descrizione,
      citta,
      quartiere,
      indirizzo_testuale,
      lat,
      lng,
      gps_source,
      gps_check_status,
      stato_pubblicazione,
      rating_avg,
      reviews_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'artigiano', 'pending', 'published', 0, 0)
  `, [
    payload.artigianoId,
    categoria.id,
    tipo.id,
    slug,
    payload.titolo,
    payload.descrizione,
    payload.citta,
    payload.quartiere,
    payload.indirizzoTestuale,
    payload.lat,
    payload.lng,
  ]);

  let coverImageId = null;
  for (const image of immaginiSalvate) {
    const [imageResult] = await pool.query(`
      INSERT INTO lavoro_immagini (
        lavoro_id,
        file_path,
        alt_text,
        caption,
        sort_order,
        is_cover,
        exif_present
      ) VALUES (?, ?, ?, ?, ?, ?, 0)
    `, [
      result.insertId,
      image.filePath,
      image.altText,
      image.caption,
      image.sortOrder,
      image.isCover,
    ]);
    if (image.isCover) coverImageId = imageResult.insertId;
  }

  if (coverImageId) {
    await pool.query(`
      UPDATE lavori
      SET cover_image_id = ?
      WHERE id = ?
    `, [coverImageId, result.insertId]);
  }

  const [rows] = await pool.query(`
    SELECT
      l.id,
      l.slug,
      l.titolo,
      l.descrizione,
      l.citta,
      l.quartiere,
      l.lat,
      l.lng,
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
    WHERE l.id = ?
    LIMIT 1
  `, [result.insertId]);

  return rows[0] || null;
}

async function findLavoroByArtigianoAndSlug(pool, artigianoSlug, lavoroSlug) {
  if (!pool) return null;
  const [rows] = await pool.query(`
    SELECT
      l.id,
      l.slug,
      l.titolo,
      l.descrizione,
      l.citta,
      l.quartiere,
      l.lat,
      l.lng,
      l.rating_avg,
      l.reviews_count,
      l.published_at,
      a.id AS artigiano_id,
      a.slug AS artigiano_slug,
      a.nome AS artigiano_nome,
      c.slug AS categoria_slug,
      c.nome AS categoria_nome,
      t.slug AS tipo_slug,
      t.nome AS tipo_nome,
      cover.file_path AS cover_path,
      cover.alt_text AS cover_alt
    FROM lavori l
    JOIN artigiani a ON a.id = l.artigiano_id
    JOIN categorie c ON c.id = l.categoria_id
    JOIN tipi_intervento t ON t.id = l.tipo_intervento_id
    LEFT JOIN lavoro_immagini cover ON cover.id = l.cover_image_id
    WHERE a.slug = ?
      AND l.slug = ?
      AND l.stato_pubblicazione = 'published'
    LIMIT 1
  `, [artigianoSlug, lavoroSlug]);
  return rows[0] || null;
}

async function updateLavoro(pool, payload) {
  if (!pool) return null;

  const lavoro = await findLavoroByArtigianoAndSlug(pool, payload.artigianoSlug, payload.lavoroSlug);
  if (!lavoro) return null;

  const categoria = await findCategoriaBySlug(pool, payload.categoriaSlug);
  if (!categoria) {
    throw new Error('Categoria non trovata nel database.');
  }

  const tipo = await createTipoIntervento(pool, categoria.id, payload.tipoNome);
  const immaginiSalvate = saveJobImages(payload.artigianoSlug, payload.lavoroSlug, payload.immagini || []);

  await pool.query(`
    UPDATE lavori
    SET categoria_id = ?,
        tipo_intervento_id = ?,
        titolo = ?,
        descrizione = ?,
        citta = ?,
        quartiere = ?,
        lat = ?,
        lng = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    categoria.id,
    tipo.id,
    payload.titolo,
    payload.descrizione,
    payload.citta,
    payload.quartiere,
    payload.lat,
    payload.lng,
    lavoro.id,
  ]);

  let coverImageId = null;
  if (immaginiSalvate.length) {
    const [existingRows] = await pool.query(`
      SELECT file_path
      FROM lavoro_immagini
      WHERE lavoro_id = ?
    `, [lavoro.id]);

    existingRows.forEach((row) => {
      const filePath = path.join(process.cwd(), 'uploads', String(row.file_path || ''));
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    });

    await pool.query(`DELETE FROM lavoro_immagini WHERE lavoro_id = ?`, [lavoro.id]);

    for (const image of immaginiSalvate) {
      const [imageResult] = await pool.query(`
        INSERT INTO lavoro_immagini (
          lavoro_id,
          file_path,
          alt_text,
          caption,
          sort_order,
          is_cover,
          exif_present
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
      `, [
        lavoro.id,
        image.filePath,
        image.altText,
        image.caption,
        image.sortOrder,
        image.isCover,
      ]);
      if (image.isCover) coverImageId = imageResult.insertId;
    }
  }

  await pool.query(`
    UPDATE lavori
    SET cover_image_id = ?
    WHERE id = ?
  `, [coverImageId, lavoro.id]);

  return findLavoroByArtigianoAndSlug(pool, payload.artigianoSlug, payload.lavoroSlug);
}

module.exports = {
  listRecentLavori,
  listAllPublishedLavoriForSeo,
  createLavoro,
  findLavoroByArtigianoAndSlug,
  updateLavoro,
};
