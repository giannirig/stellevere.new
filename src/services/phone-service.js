function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function nationalDigits(phone) {
  const normalized = normalizePhone(phone);
  let digits = normalized.replace(/[^\d]/g, '');
  if (digits.startsWith('39') && digits.length > 10) digits = digits.slice(2);
  return digits;
}

function detectPhoneType(phone) {
  let digits = nationalDigits(phone);

  if (!digits) return 'unknown';
  if (/^3\d{8,10}$/.test(digits)) return 'mobile';
  if (/^0\d{5,10}$/.test(digits)) return 'landline';
  return 'unknown';
}

function formatDisplayPhone(phone) {
  const digits = nationalDigits(phone);
  const phoneType = detectPhoneType(digits);

  if (phoneType === 'mobile') {
    if (digits.length === 10) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    if (digits.length > 6) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`.trim();
    }
  }

  if (phoneType === 'landline') {
    if (digits.startsWith('06')) {
      return `${digits.slice(0, 2)} ${digits.slice(2)}`.trim();
    }
    if (digits.length > 3) {
      return `${digits.slice(0, 3)} ${digits.slice(3)}`.trim();
    }
  }

  return digits || String(phone || '').trim();
}

function claimChannelForPhone(phone) {
  const phoneType = detectPhoneType(phone);
  if (phoneType === 'mobile') return 'sms';
  if (phoneType === 'landline') return 'voice';
  return 'voice';
}

function phoneTypeLabel(phoneType) {
  if (phoneType === 'mobile') return 'Cellulare';
  if (phoneType === 'landline') return 'Numero fisso';
  return 'Numero da verificare';
}

module.exports = {
  normalizePhone,
  detectPhoneType,
  claimChannelForPhone,
  phoneTypeLabel,
  formatDisplayPhone,
};
