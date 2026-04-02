async function createClaimRequest(pool, payload) {
  if (!pool) return null;
  const [result] = await pool.query(`
    INSERT INTO artigiano_claims (artigiano_id, telefono_verificato, metodo_claim, stato)
    VALUES (?, ?, ?, 'pending')
  `, [payload.artigianoId, payload.telefonoVerificato, payload.metodoClaim]);
  return result.insertId;
}

async function createOtpCode(pool, payload) {
  if (!pool) return null;
  const [result] = await pool.query(`
    INSERT INTO otp_codes (artigiano_id, claim_id, channel, codice, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `, [payload.artigianoId, payload.claimId, payload.channel, payload.code, payload.expiresAt]);
  return result.insertId;
}

async function findActiveOtpByArtigiano(pool, artigianoId) {
  if (!pool) return null;
  const [rows] = await pool.query(`
    SELECT *
    FROM otp_codes
    WHERE artigiano_id = ?
      AND verified_at IS NULL
      AND expires_at > NOW()
    ORDER BY id DESC
    LIMIT 1
  `, [artigianoId]);
  return rows[0] || null;
}

async function incrementOtpAttempts(pool, otpId) {
  if (!pool) return;
  await pool.query(`
    UPDATE otp_codes
    SET attempts_count = attempts_count + 1
    WHERE id = ?
  `, [otpId]);
}

async function markOtpVerified(pool, otpId) {
  if (!pool) return;
  await pool.query(`
    UPDATE otp_codes
    SET verified_at = NOW()
    WHERE id = ?
  `, [otpId]);
}

async function markClaimVerified(pool, claimId) {
  if (!pool || !claimId) return;
  await pool.query(`
    UPDATE artigiano_claims
    SET stato = 'verified',
        verificato_at = NOW()
    WHERE id = ?
  `, [claimId]);
}

async function markClaimFailed(pool, claimId) {
  if (!pool || !claimId) return;
  await pool.query(`
    UPDATE artigiano_claims
    SET stato = 'failed'
    WHERE id = ?
  `, [claimId]);
}

async function updateArtigianoClaimState(pool, payload) {
  if (!pool) return;
  await pool.query(`
    UPDATE artigiani
    SET claim_status = ?,
        otp_channel = ?,
        telefono_tipo = COALESCE(?, telefono_tipo)
    WHERE id = ?
  `, [payload.claimStatus, payload.otpChannel, payload.phoneType, payload.artigianoId]);
}

module.exports = {
  createClaimRequest,
  createOtpCode,
  findActiveOtpByArtigiano,
  incrementOtpAttempts,
  markOtpVerified,
  markClaimVerified,
  markClaimFailed,
  updateArtigianoClaimState,
};
