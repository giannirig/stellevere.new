const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(process.cwd(), 'data', 'new-profile-requests.json');

function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ requests: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (_) {
    return { requests: [] };
  }
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function createProfileRequest(payload) {
  const store = readStore();
  const request = {
    id: Date.now(),
    nome_attivita: String(payload.nome_attivita || '').trim(),
    categoria: String(payload.categoria || '').trim(),
    indirizzo_via: String(payload.indirizzo_via || '').trim(),
    indirizzo_numero_civico: String(payload.indirizzo_numero_civico || '').trim(),
    indirizzo_cap: String(payload.indirizzo_cap || '').trim(),
    indirizzo: String(payload.indirizzo || '').trim(),
    citta: String(payload.citta || '').trim(),
    indirizzo_provincia: String(payload.indirizzo_provincia || '').trim(),
    telefono: String(payload.telefono || '').trim(),
    partita_iva: String(payload.partita_iva || '').trim(),
    email: String(payload.email || '').trim(),
    orari_apertura: Array.isArray(payload.orari_apertura) ? payload.orari_apertura : [],
    sito_web: String(payload.sito_web || '').trim(),
    facebook_url: String(payload.facebook_url || '').trim(),
    instagram_url: String(payload.instagram_url || '').trim(),
    tiktok_url: String(payload.tiktok_url || '').trim(),
    referente: String(payload.referente || '').trim(),
    descrizione_attivita: String(payload.descrizione_attivita || '').trim(),
    media: {
      logo_data: String(payload.logo_data || '').trim(),
      foto_1_data: String(payload.foto_1_data || '').trim(),
      foto_2_data: String(payload.foto_2_data || '').trim(),
      foto_3_data: String(payload.foto_3_data || '').trim(),
    },
    consensi: {
      termini: Boolean(payload.consenso_termini),
      privacy: Boolean(payload.consenso_privacy),
      contatto_email: Boolean(payload.consenso_email),
    },
    email_confirmation_token: crypto.randomBytes(24).toString('hex'),
    email_confirmed_at: null,
    stato: 'in_attesa',
    created_at: new Date().toISOString(),
  };
  store.requests.unshift(request);
  writeStore(store);
  return request;
}

function findProfileRequestByToken(token) {
  const store = readStore();
  return store.requests.find((request) => request.email_confirmation_token === token) || null;
}

function confirmProfileRequest(token) {
  const store = readStore();
  const request = store.requests.find((item) => item.email_confirmation_token === token);
  if (!request) return null;
  if (!request.email_confirmed_at) {
    request.email_confirmed_at = new Date().toISOString();
    request.stato = 'email_confermata';
    writeStore(store);
  }
  return request;
}

module.exports = {
  createProfileRequest,
  findProfileRequestByToken,
  confirmProfileRequest,
};
