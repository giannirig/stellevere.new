const {
  createClaimRequest,
  createOtpCode,
  findActiveOtpByArtigiano,
  incrementOtpAttempts,
  markOtpVerified,
  markClaimVerified,
  markClaimFailed,
  updateArtigianoClaimState,
} = require('../../repositories/claims-repo');
const { sendTwilioOtp } = require('../../config/twilio');
const { claimChannelForPhone, detectPhoneType, phoneTypeLabel } = require('../../services/phone-service');

const otpStore = new Map();

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildDeliveryMessage({ channel, phone, code, twilioEnabled }) {
  if (channel === 'sms') {
    return twilioEnabled
      ? `Invieremo un SMS Twilio al numero ${phone} con il codice OTP.`
      : `Twilio non è configurato: simulazione SMS pronta per ${phone}. Codice demo: ${code}`;
  }
  return twilioEnabled
    ? `Avvieremo una chiamata vocale Twilio al numero ${phone} per dettare il codice OTP.`
    : `Twilio non è configurato: simulazione vocale pronta per ${phone}. Codice demo: ${code}`;
}

async function startClaim(pool, payload) {
  return createClaimRequest(pool, payload);
}

async function initiateClaim(pool, artigiano, twilioConfig) {
  const phone = artigiano.telefono || '';
  const phoneType = detectPhoneType(phone);
  const channel = claimChannelForPhone(phone);
  const code = generateOtpCode();
  const expiresAt = Date.now() + (10 * 60 * 1000);
  const key = String(artigiano.slug || artigiano.id);

  let claimId = null;
  let otpId = null;

  try {
    claimId = await startClaim(pool, {
      artigianoId: artigiano.id,
      telefonoVerificato: phone,
      metodoClaim: channel,
    });

    await updateArtigianoClaimState(pool, {
      artigianoId: artigiano.id,
      claimStatus: 'pending',
      otpChannel: channel,
      phoneType,
    });

    otpId = await createOtpCode(pool, {
      artigianoId: artigiano.id,
      claimId,
      channel,
      code,
      expiresAt: new Date(expiresAt),
    });
  } catch (_) {}

  otpStore.set(key, {
    artigianoId: artigiano.id,
    code,
    channel,
    phone,
    phoneType,
    expiresAt,
    claimId,
    otpId,
  });

  try {
    await sendTwilioOtp(twilioConfig, {
      channel,
      to: phone,
      code,
    });
  } catch (_) {}

  return {
    claimId,
    channel,
    phone,
    phoneType,
    phoneTypeLabel: phoneTypeLabel(phoneType),
    expiresAt,
    twilioEnabled: Boolean(twilioConfig && twilioConfig.enabled),
    deliveryMessage: buildDeliveryMessage({
      channel,
      phone,
      code,
      twilioEnabled: Boolean(twilioConfig && twilioConfig.enabled),
    }),
    demoCode: code,
  };
}

function getPendingClaimFromMemory(artigiano) {
  const key = String(artigiano.slug || artigiano.id);
  const state = otpStore.get(key);
  if (!state) return null;
  if (state.expiresAt < Date.now()) {
    otpStore.delete(key);
    return null;
  }
  return state;
}

async function getPendingClaim(pool, artigiano) {
  const inMemory = getPendingClaimFromMemory(artigiano);
  if (inMemory) return inMemory;

  if (!pool) return null;
  let otp = null;
  try {
    otp = await findActiveOtpByArtigiano(pool, artigiano.id);
  } catch (_) {
    return null;
  }
  if (!otp) return null;

  return {
    artigianoId: artigiano.id,
    code: otp.codice,
    channel: otp.channel,
    phone: artigiano.telefono,
    phoneType: detectPhoneType(artigiano.telefono),
    expiresAt: new Date(otp.expires_at).getTime(),
    claimId: otp.claim_id,
    otpId: otp.id,
  };
}

async function verifyClaimCode(pool, artigiano, submittedCode) {
  let pending = null;
  try {
    pending = await getPendingClaim(pool, artigiano);
  } catch (_) {
    pending = null;
  }
  if (!pending) {
    return { ok: false, message: 'Il codice è scaduto o non è stato richiesto.' };
  }

  if (String(submittedCode || '').trim() !== pending.code) {
    try {
      if (pending.otpId) await incrementOtpAttempts(pool, pending.otpId);
      if (pending.claimId) await markClaimFailed(pool, pending.claimId);
    } catch (_) {}
    return { ok: false, message: 'Il codice inserito non è corretto.' };
  }

  otpStore.delete(String(artigiano.slug || artigiano.id));
  try {
    if (pending.otpId) await markOtpVerified(pool, pending.otpId);
    if (pending.claimId) await markClaimVerified(pool, pending.claimId);
    await updateArtigianoClaimState(pool, {
      artigianoId: artigiano.id,
      claimStatus: 'claimed',
      otpChannel: pending.channel,
      phoneType: pending.phoneType,
    });
  } catch (_) {}

  return {
    ok: true,
    channel: pending.channel,
    phone: pending.phone,
    phoneType: pending.phoneType,
  };
}

module.exports = {
  startClaim,
  initiateClaim,
  getPendingClaim,
  verifyClaimCode,
};
