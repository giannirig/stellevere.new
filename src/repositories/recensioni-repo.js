async function listLatestRecensioni(pool, limit = 10) {
  if (!pool) return [];
  const [rows] = await pool.query(`
    SELECT r.id, r.cliente_nome, r.voto, r.testo, r.data_recensione, l.titolo
    FROM recensioni r
    JOIN lavori l ON l.id = r.lavoro_id
    WHERE r.stato = 'published'
    ORDER BY r.data_recensione DESC
    LIMIT ?
  `, [limit]);
  return rows;
}

async function listRecensioniByLavoroId(pool, lavoroId, limit = 10) {
  if (!pool) return [];
  const [rows] = await pool.query(`
    SELECT id, cliente_nome, voto, testo, data_recensione
    FROM recensioni
    WHERE lavoro_id = ?
      AND stato = 'published'
    ORDER BY data_recensione DESC
    LIMIT ?
  `, [lavoroId, limit]);
  return rows;
}

async function createRecensioneForLavoro(pool, payload) {
  if (!pool) return null;

  const [result] = await pool.query(`
    INSERT INTO recensioni (lavoro_id, artigiano_id, cliente_nome, voto, testo, stato)
    VALUES (?, ?, ?, ?, ?, 'published')
  `, [
    payload.lavoroId,
    payload.artigianoId,
    payload.clienteNome,
    payload.voto,
    payload.testo,
  ]);

  await pool.query(`
    UPDATE lavori l
    JOIN (
      SELECT lavoro_id, COUNT(*) AS reviews_count, AVG(voto) AS rating_avg
      FROM recensioni
      WHERE stato = 'published' AND lavoro_id = ?
      GROUP BY lavoro_id
    ) r ON r.lavoro_id = l.id
    SET l.reviews_count = r.reviews_count,
        l.rating_avg = ROUND(r.rating_avg, 1)
    WHERE l.id = ?
  `, [payload.lavoroId, payload.lavoroId]);

  await pool.query(`
    UPDATE artigiani a
    JOIN (
      SELECT artigiano_id, COUNT(*) AS reviews_count, AVG(voto) AS rating_avg
      FROM recensioni
      WHERE stato = 'published' AND artigiano_id = ?
      GROUP BY artigiano_id
    ) r ON r.artigiano_id = a.id
    SET a.reviews_count = r.reviews_count,
        a.rating_avg = ROUND(r.rating_avg, 1)
    WHERE a.id = ?
  `, [payload.artigianoId, payload.artigianoId]);

  return {
    id: result.insertId,
    cliente_nome: payload.clienteNome,
    voto: payload.voto,
    testo: payload.testo,
  };
}

module.exports = {
  listLatestRecensioni,
  listRecensioniByLavoroId,
  createRecensioneForLavoro,
};
