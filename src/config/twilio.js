function createTwilioConfig(env) {
  return {
    enabled: Boolean(env.twilio.accountSid && env.twilio.authToken && env.twilio.fromPhone),
    accountSid: env.twilio.accountSid,
    authToken: env.twilio.authToken,
    fromPhone: env.twilio.fromPhone,
  };
}

async function sendTwilioOtp(twilioConfig, payload) {
  if (!twilioConfig || !twilioConfig.enabled) {
    return { delivered: false, simulated: true };
  }

  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}`;
  const authHeader = Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString('base64');
  const params = new URLSearchParams();
  params.set('To', payload.to);
  params.set('From', twilioConfig.fromPhone);

  let endpoint = `${baseUrl}/Messages.json`;
  if (payload.channel === 'sms') {
    params.set('Body', `Il tuo codice StelleVere è ${payload.code}`);
  } else {
    endpoint = `${baseUrl}/Calls.json`;
    params.set('Twiml', `<Response><Say language="it-IT" voice="alice">Il tuo codice di verifica Stelle Vere è ${payload.code.split('').join(' ')}.</Say></Response>`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio error ${response.status}: ${text}`);
  }

  return { delivered: true, simulated: false };
}

module.exports = {
  createTwilioConfig,
  sendTwilioOtp,
};
