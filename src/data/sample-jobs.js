function buildExampleImageDataUri(title) {
  const safeTitle = String(title || 'Lavoro esempio')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c8e7ef" />
          <stop offset="100%" stop-color="#7db7c9" />
        </linearGradient>
      </defs>
      <rect width="800" height="520" rx="36" fill="url(#g)" />
      <circle cx="116" cy="120" r="64" fill="rgba(255,255,255,0.32)" />
      <rect x="68" y="330" width="664" height="116" rx="24" fill="rgba(255,255,255,0.78)" />
      <text x="68" y="120" font-family="Georgia, serif" font-size="34" fill="#1d6d84" font-weight="700">Idraulica</text>
      <text x="68" y="388" font-family="Georgia, serif" font-size="40" fill="#1d6d84" font-weight="700">${safeTitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const IDRAULICA_SAMPLE_JOBS = [
  {
    titolo: 'Sostituzione Caldaia a Condensazione',
    descrizione: 'Esempio di scheda lavoro per sostituzione caldaia murale con installazione, collaudo e verifica finale del corretto funzionamento.',
  },
  {
    titolo: 'Rifacimento Bagno Completo',
    descrizione: 'Esempio di scheda lavoro per rifacimento bagno con nuovi sanitari, rubinetteria e revisione completa degli attacchi idraulici.',
  },
  {
    titolo: 'Sostituzione Rubinetteria Bagno',
    descrizione: 'Esempio di scheda lavoro per sostituzione miscelatori bagno e cucina con modelli a risparmio idrico.',
  },
  {
    titolo: 'Ricerca Perdita Acqua',
    descrizione: 'Esempio di scheda lavoro per individuazione perdita su impianto idrico con ripristino del tratto danneggiato.',
  },
  {
    titolo: 'Sostituzione Scaldabagno',
    descrizione: 'Esempio di scheda lavoro per rimozione vecchio scaldabagno e installazione di un nuovo apparecchio.',
  },
  {
    titolo: 'Disotturazione Scarico Cucina',
    descrizione: 'Esempio di scheda lavoro per pulizia e ripristino di uno scarico cucina ostruito con verifica finale del deflusso.',
  },
  {
    titolo: 'Installazione Box Doccia',
    descrizione: 'Esempio di scheda lavoro per montaggio box doccia con sigillatura, fissaggi e rifiniture finali.',
  },
  {
    titolo: 'Scheda vuota',
    descrizione: 'Modello vuoto da personalizzare con foto, descrizione e dettagli del lavoro reale svolto.',
    is_blank: true,
  },
];

function buildSampleJobsForArtigiano(artigiano) {
  const buildGallery = (title) => ([
    {
      src: buildExampleImageDataUri(`${title} · Fase 1`),
      name: `${title} fase 1`,
    },
    {
      src: buildExampleImageDataUri(`${title} · Fase 2`),
      name: `${title} fase 2`,
    },
    {
      src: buildExampleImageDataUri(`${title} · Risultato`),
      name: `${title} risultato finale`,
    },
  ]);

  return IDRAULICA_SAMPLE_JOBS.map((item, index) => ({
    id: `${artigiano.slug}-sample-${index + 1}`,
    slug: `esempio-${index + 1}-${artigiano.slug}`,
    titolo: item.titolo,
    descrizione: item.descrizione,
    citta: artigiano.citta_principale || '',
    quartiere: '',
    rating_avg: 0,
    reviews_count: 0,
    published_at: '',
    categoria_slug: 'idraulica',
    categoria_nome: 'Idraulica',
    tipo_slug: '',
    tipo_nome: item.titolo,
    cover_path: buildExampleImageDataUri(item.titolo),
    cover_alt: item.titolo,
    immagini: buildGallery(item.titolo),
    is_example: true,
    is_blank: Boolean(item.is_blank),
  }));
}

module.exports = {
  buildSampleJobsForArtigiano,
};
