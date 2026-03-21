const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// ── Config ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.json({ limit: '50mb' }));

// ── Helpers ──
function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildJobsIndex() {
  const jobs = [];
  for (const art of Object.values(ARTIGIANI)) {
    for (const lavoro of art.lavori) {
      jobs.push({ ...lavoro, artigiano: art });
    }
  }
  return jobs;
}

function jobsByCategoryCity(jobs, catSlug, cittaSlug, quartSlug) {
  return jobs.filter(j => {
    const art = j.artigiano;
    if (catSlug && (art.cat_slug || '') !== catSlug) return false;
    if (cittaSlug && slugify(j.citta || '') !== cittaSlug) return false;
    if (quartSlug && slugify(j.quartiere || '') !== quartSlug) return false;
    return true;
  });
}

function jobsBySubcat(tuttiJobs, catSlug, subcatSlug, cittaSlug) {
  return tuttiJobs.filter(j => {
    if ((j.artigiano.cat_slug || '') !== catSlug) return false;
    if ((j.sottocategoria_slug || '') !== subcatSlug) return false;
    if (cittaSlug && slugify(j.citta || '') !== cittaSlug) return false;
    return true;
  });
}

function buildJobUrl(catSlug, job) {
  const ts = slugify(job.titolo);
  const citta = slugify(job.citta || '');
  const quart = slugify(job.quartiere || '');
  const cs = quart ? `${citta}-${quart}` : citta;
  const subcat = job.sottocategoria_slug;
  if (subcat) return `/${catSlug}/${subcat}/${ts}/${cs}`;
  return `/${catSlug}/${ts}/${cs}`;
}

// Make helpers available in all templates
app.locals.slugify = slugify;
app.locals.buildJobUrl = buildJobUrl;

// ── Data ──
const SOTTOCATEGORIE = {
  idraulica: {
    caldaie:   { nome: 'Caldaie',     desc: 'Installazione e sostituzione caldaie a condensazione' },
    bagni:     { nome: 'Bagni',       desc: 'Rifacimento e ristrutturazione bagni chiavi in mano' },
    urgenze:   { nome: 'Urgenze H24', desc: 'Interventi urgenti perdite e rotture 24/7' },
    impianti:  { nome: 'Impianti',    desc: 'Impianti idrici, termici e di riscaldamento' },
    scarichi:  { nome: 'Scarichi',    desc: 'Disintasamento colonne e riparazione scarichi' },
    rubinetti: { nome: 'Rubinetti',   desc: 'Sostituzione rubinetteria e sanitari' },
  },
  elettricista: {
    'impianti-elettrici': { nome: 'Impianti Elettrici', desc: 'Rifacimento e messa a norma CEI 64-8' },
    fotovoltaico:         { nome: 'Fotovoltaico',       desc: 'Installazione pannelli solari e accumulo' },
    climatizzatori:       { nome: 'Climatizzatori',     desc: 'Installazione e manutenzione split inverter' },
    domotica:             { nome: 'Domotica',           desc: 'Sistemi smart home, luci e tapparelle automatiche' },
    illuminazione:        { nome: 'Illuminazione',      desc: 'Impianti LED design interno ed esterno' },
    urgenze:              { nome: 'Urgenze H24',        desc: 'Guasti elettrici, cortocircuiti, blackout' },
  },
  imbianchino: {
    interni:        { nome: 'Interni',         desc: 'Tinteggiatura appartamenti, uffici e interni' },
    esterni:        { nome: 'Esterni',         desc: 'Facciate esterne, intonaci e pittura silossanica' },
    stucchi:        { nome: 'Stucchi',         desc: 'Stucco veneziano, decorativi e rasature al civile' },
    isolamento:     { nome: 'Isolamento',      desc: 'Cappotto termico e isolamento acustico esterno' },
    'carta-parati': { nome: 'Carta da Parati', desc: 'Posa carta da parati, murals e carte speciali' },
  },
  muratore: {
    pavimenti:              { nome: 'Pavimenti',              desc: 'Posa gres, piastrelle, parquet e massetti' },
    demolizioni:            { nome: 'Demolizioni',            desc: 'Abbattimento pareti, rimozione pavimenti' },
    ristrutturazioni:       { nome: 'Ristrutturazioni',       desc: 'Ristrutturazioni complete chiavi in mano' },
    intonaci:               { nome: 'Intonaci',               desc: 'Intonaco tradizionale, rasature e stucco' },
    impermeabilizzazioni:   { nome: 'Impermeabilizzazioni',   desc: 'Terrazzi, box, piscine e fondamenta' },
  },
  falegname: {
    cucine:  { nome: 'Cucine',  desc: 'Cucine su misura in legno massello e moderno' },
    armadi:  { nome: 'Armadi',  desc: 'Armadi a muro, cabine armadio e guardaroba' },
    porte:   { nome: 'Porte',   desc: 'Porte interne, infissi e serramenti in legno' },
    parquet: { nome: 'Parquet', desc: 'Posa, levigatura e restauro parquet' },
    mobili:  { nome: 'Mobili',  desc: 'Mobili su misura, restauro e antiquariato' },
  },
  altro: {
    traslochi:      { nome: 'Traslochi',      desc: 'Trasloco appartamenti e uffici con furgone' },
    condizionatori: { nome: 'Condizionatori', desc: 'Installazione e manutenzione condizionatori' },
    giardini:       { nome: 'Giardini',       desc: 'Giardinaggio, potatura e cura verde' },
    montaggio:      { nome: 'Montaggio',      desc: 'Montaggio mobili e assemblaggio' },
  },
};

const CATEGORIE = {
  idraulica:    { nome: 'Idraulica',    cat_tipo: 'Idraulico',    plurale: 'Idraulici',    icona: 'drop' },
  elettricista: { nome: 'Elettricista', cat_tipo: 'Elettricista', plurale: 'Elettricisti', icona: 'zap' },
  imbianchino:  { nome: 'Imbianchino',  cat_tipo: 'Imbianchino',  plurale: 'Imbianchini',  icona: 'paint' },
  muratore:     { nome: 'Muratore',     cat_tipo: 'Muratore',     plurale: 'Muratori',     icona: 'wall' },
  falegname:    { nome: 'Falegname',    cat_tipo: 'Falegname',    plurale: 'Falegnami',    icona: 'wood' },
  altro:        { nome: 'Altro',        cat_tipo: 'Artigiano',    plurale: 'Artigiani',    icona: 'tool' },
};

const ARTIGIANI = {
  'fossati-antonio': {
    id: 'fossati-antonio', nome: 'Fossati Antonio', categoria: 'Idraulico',
    cat_slug: 'idraulica', citta: 'Milano', stelle: 5.0, recensioni: 23,
    telefono: '+39 333 123 4567',
    lavori: [
      { id: 1, titolo: 'Sostituzione Caldaia Condominiale', sottocategoria_slug: 'caldaie',
        descrizione: 'Sostituzione completa caldaia condominiale da 80kW con modello ad alta efficienza. Lavoro eseguito in 2 giorni, compreso smaltimento vecchia caldaia e collaudo impianto.',
        citta: 'Milano', quartiere: 'Porta Venezia', stelle: 5, visite: 38,
        recensione: 'Caldaia sostituita in 2 giorni. Preciso, pulito, puntuale.', cliente: 'Luca C.',
        immagini: [
          { file: 'idraulica-sostituzione-caldaia-condominiale-milano-porta-venezia-01.jpg',
            alt: 'Foto principale – Idraulica: sostituzione caldaia condominiale a Porta Venezia, Milano – Fossati Antonio',
            caption: 'Nuova caldaia a condensazione classe A+ installata', posizione: 'Principale' },
          { file: 'idraulica-sostituzione-caldaia-condominiale-milano-porta-venezia-02.jpg',
            alt: 'Dettaglio tubazioni raccordi in rame – installazione caldaia Porta Venezia Milano',
            caption: 'Raccordi in rame con guarnizioni nuove', posizione: 'Dettaglio' },
          { file: 'idraulica-sostituzione-caldaia-condominiale-milano-porta-venezia-03.jpg',
            alt: 'Risultato finale – impianto caldaia condominiale Milano Porta Venezia collaudato',
            caption: 'Impianto ultimato, collaudato e certificato', posizione: 'Risultato' },
        ] },
      { id: 2, titolo: 'Rifacimento Bagno Completo', sottocategoria_slug: 'bagni',
        descrizione: 'Rifacimento completo del bagno: demolizione pavimento e rivestimenti, nuova posa piastrelle, installazione sanitari e rubinetteria.',
        citta: 'Milano', quartiere: 'Navigli', stelle: 5, visite: 52,
        recensione: 'Bagno rifatto in una settimana, tutto perfetto. Prezzo onesto.', cliente: 'Maria R.',
        immagini: [
          { file: 'idraulica-rifacimento-bagno-completo-milano-navigli-01.jpg',
            alt: 'Foto principale – rifacimento bagno completo ai Navigli Milano – Fossati Antonio idraulico',
            caption: 'Nuovo box doccia e sanitari sospesi installati', posizione: 'Principale' },
          { file: 'idraulica-rifacimento-bagno-completo-milano-navigli-02.jpg',
            alt: 'Dettaglio posa piastrelle grande formato bagno Navigli Milano',
            caption: 'Piastrelle 60×120 posate a filo', posizione: 'Dettaglio' },
        ] },
      { id: 3, titolo: 'Perdita Urgente H24', sottocategoria_slug: 'urgenze',
        descrizione: "Intervento di emergenza per perdita d'acqua notturna. Riparazione tubazione rotta sotto pavimento.",
        citta: 'Milano', quartiere: 'Città Studi', stelle: 5, visite: 29,
        recensione: "Perdita di notte risolta in un'ora. Disponibile H24, professionista vero.", cliente: 'Giorgio P.',
        immagini: [
          { file: 'idraulica-perdita-urgente-h24-milano-citta-studi-01.jpg',
            alt: 'Riparazione perdita urgente – tubazione rotta riparata in notturna Città Studi Milano',
            caption: 'Tubazione riparata con giunto a pressione', posizione: 'Principale' },
        ] },
      { id: 4, titolo: 'Impianto Termosifoni', sottocategoria_slug: 'impianti',
        descrizione: "Installazione nuovo impianto di riscaldamento con termosifoni in alluminio. Progettazione, fornitura e posa completa.",
        citta: 'Milano', quartiere: 'Brera', stelle: 5, visite: 41,
        recensione: "Impianto realizzato a regola d'arte. Consigliatissimo!", cliente: 'Sara M.',
        immagini: [
          { file: 'idraulica-impianto-termosifoni-milano-brera-01.jpg',
            alt: 'Nuovi termosifoni in alluminio installati a Brera Milano – Fossati Antonio',
            caption: 'Radiatori in alluminio con valvole termostatiche', posizione: 'Principale' },
          { file: 'idraulica-impianto-termosifoni-milano-brera-02.jpg',
            alt: 'Dettaglio raccordi impianto termosifoni Brera Milano',
            caption: 'Bilanciamento impianto e test pressione completati', posizione: 'Dettaglio' },
        ] },
    ],
  },
  'ricci-marco': {
    id: 'ricci-marco', nome: 'Ricci Marco', categoria: 'Idraulico',
    cat_slug: 'idraulica', citta: 'Milano', stelle: 4.8, recensioni: 17,
    telefono: '+39 348 765 4321',
    lavori: [
      { id: 5, titolo: 'Installazione Scalda Acqua', sottocategoria_slug: 'impianti',
        descrizione: 'Installazione boiler elettrico 80L con valvola di sicurezza. Smaltimento vecchio e collaudo.',
        citta: 'Milano', quartiere: 'San Siro', stelle: 5, visite: 22,
        recensione: 'Lavoro fatto bene, in tempi rapidi. Lo richiamerei.', cliente: 'Paolo F.' },
      { id: 6, titolo: 'Sostituzione Rubinetteria Cucina', sottocategoria_slug: 'rubinetti',
        descrizione: 'Sostituzione rubinetto cucina e sifone. Intervento pulito e veloce.',
        citta: 'Milano', quartiere: 'Isola', stelle: 5, visite: 18,
        recensione: 'Puntuale e professionale. Ottimo lavoro.', cliente: 'Giulia T.' },
    ],
  },
  'ferrari-luigi': {
    id: 'ferrari-luigi', nome: 'Ferrari Luigi', categoria: 'Elettricista',
    cat_slug: 'elettricista', citta: 'Milano', stelle: 4.9, recensioni: 31,
    telefono: '+39 366 222 3344',
    lavori: [
      { id: 7, titolo: 'Impianto Elettrico Appartamento', sottocategoria_slug: 'impianti-elettrici',
        descrizione: 'Rifacimento completo impianto elettrico con quadro moderno differenziali a norma CEI 64-8.',
        citta: 'Milano', quartiere: 'Navigli', stelle: 5, visite: 67,
        recensione: 'Lavoro impeccabile, impianto a norma. Professionale e puntuale.', cliente: 'Roberto A.' },
      { id: 8, titolo: 'Installazione Climatizzatore', sottocategoria_slug: 'climatizzatori',
        descrizione: 'Installazione split dual inverter con gas R32, foratura muro e collaudo.',
        citta: 'Milano', quartiere: 'Porta Romana', stelle: 5, visite: 44,
        recensione: 'Ottimo lavoro, veloce e preciso. Molto soddisfatto.', cliente: 'Francesca B.' },
    ],
  },
  'bianchi-carlo': {
    id: 'bianchi-carlo', nome: 'Bianchi Carlo', categoria: 'Elettricista',
    cat_slug: 'elettricista', citta: 'Roma', stelle: 4.7, recensioni: 14,
    telefono: '+39 347 888 9900',
    lavori: [
      { id: 9, titolo: 'Sostituzione Quadro Elettrico', sottocategoria_slug: 'impianti-elettrici',
        descrizione: 'Sostituzione quadro obsoleto con nuovo centralino con differenziali separati per zona.',
        citta: 'Roma', quartiere: 'Prati', stelle: 5, visite: 33,
        recensione: 'Preciso e affidabile. Impianto perfetto.', cliente: 'Matteo G.' },
      { id: 10, titolo: 'Punti Luce e Prese Aggiuntivi', sottocategoria_slug: 'illuminazione',
        descrizione: 'Aggiunta punti presa e luce in soggiorno. Passaggio cavi sotto traccia.',
        citta: 'Roma', quartiere: 'Trastevere', stelle: 5, visite: 28,
        recensione: 'Lavoro ben fatto, zona rimasta pulita.', cliente: 'Anna V.' },
    ],
  },
  'esposito-giovanni': {
    id: 'esposito-giovanni', nome: 'Esposito Giovanni', categoria: 'Imbianchino',
    cat_slug: 'imbianchino', citta: 'Roma', stelle: 4.9, recensioni: 28,
    telefono: '+39 339 111 2233',
    lavori: [
      { id: 11, titolo: 'Tinteggiatura Appartamento 90mq', sottocategoria_slug: 'interni',
        descrizione: 'Tinteggiatura completa 90mq: preparazione pareti, stucco, primer e due mani pittura lavabile.',
        citta: 'Roma', quartiere: 'Parioli', stelle: 5, visite: 55,
        recensione: 'Lavoro perfetto, casa come nuova. Consigliatissimo!', cliente: 'Claudia M.' },
      { id: 12, titolo: 'Stucco Veneziano Camera da Letto', sottocategoria_slug: 'stucchi',
        descrizione: 'Applicazione stucco veneziano a due strati con finitura a cera e lucidatura.',
        citta: 'Roma', quartiere: 'Testaccio', stelle: 5, visite: 38,
        recensione: 'Risultato bellissimo, artigiano vero.', cliente: 'Lorenzo P.' },
    ],
  },
  'russo-stefano': {
    id: 'russo-stefano', nome: 'Russo Stefano', categoria: 'Muratore',
    cat_slug: 'muratore', citta: 'Milano', stelle: 4.8, recensioni: 19,
    telefono: '+39 340 555 6677',
    lavori: [
      { id: 13, titolo: 'Posa Pavimento Gres 60x60', sottocategoria_slug: 'pavimenti',
        descrizione: 'Posa 55mq gres porcellanato su massetto autolivellante. Fughe con stuccatura epossidica.',
        citta: 'Milano', quartiere: 'Niguarda', stelle: 5, visite: 31,
        recensione: 'Posa perfetta, pavimento bellissimo.', cliente: 'Elena C.' },
      { id: 14, titolo: 'Demolizione Parete e Cartongesso', sottocategoria_slug: 'demolizioni',
        descrizione: 'Abbattimento parete non portante, nuova parete in cartongesso con isolamento acustico.',
        citta: 'Milano', quartiere: 'Bicocca', stelle: 5, visite: 25,
        recensione: 'Lavoro pulito e veloce. Molto professionale.', cliente: 'Marco L.' },
    ],
  },
  'de-luca-piero': {
    id: 'de-luca-piero', nome: 'De Luca Piero', categoria: 'Idraulico',
    cat_slug: 'idraulica', citta: 'Roma', stelle: 4.9, recensioni: 21,
    telefono: '+39 333 444 5566',
    lavori: [
      { id: 15, titolo: 'Rifacimento Impianto Idrico', sottocategoria_slug: 'impianti',
        descrizione: 'Rifacimento completo impianto idrico appartamento 70mq. Tubi in multistrato, collaudo incluso.',
        citta: 'Roma', quartiere: 'Prati', stelle: 5, visite: 43,
        recensione: 'Lavoro eccellente, nessun problema. Molto raccomandato.', cliente: 'Simone D.' },
      { id: 16, titolo: 'Sostituzione Caldaia Murale', sottocategoria_slug: 'caldaie',
        descrizione: 'Sostituzione caldaia murale con modello a condensazione classe A+ con cronotermostato Wi-Fi.',
        citta: 'Roma', quartiere: 'Flaminio', stelle: 5, visite: 37,
        recensione: 'Veloce, preciso, prezzi onesti. Lo riconfermerò.', cliente: 'Valentina R.' },
    ],
  },
  idratest: {
    id: 'idratest', nome: 'Idratest', emoji: '🔧', categoria: 'Idraulico',
    cat_slug: 'idraulica', citta: 'Milano', stelle: 5.0, recensioni: 0,
    telefono: '+39 391 156 6400',
    lavori: [],
  },
};

const ESEMPI_PER_CATEGORIA = {
  Idraulica: [
    { titolo: 'Sostituzione Caldaia a Condensazione', descrizione: 'Sostituzione caldaia murale con modello a condensazione classe A. Collaudo e certificazione inclusi.' },
    { titolo: 'Rifacimento Bagno Completo', descrizione: 'Ristrutturazione bagno: demolizione, nuovi sanitari sospesi, box doccia, piastrelle e rubinetteria.' },
    { titolo: 'Riparazione Perdita Urgente', descrizione: "Intervento rapido per perdita d'acqua da tubo sotto traccia. Riparazione definitiva in giornata." },
    { titolo: 'Installazione Termosifoni', descrizione: 'Installazione radiatori in alluminio con valvole termostatiche e bilanciamento impianto.' },
    { titolo: 'Scarico Intasato Cucina', descrizione: 'Disintasamento colonna scarico cucina e sostituzione sifone. Intervento rapido con idropulitrice.' },
    { titolo: 'Sostituzione Rubinetteria Bagno', descrizione: 'Sostituzione completa miscelatori bagno e cucina con modelli a risparmio idrico certificati.' },
    { titolo: 'Impianto Idrico Ristrutturazione', descrizione: 'Rifacimento completo impianto idrico per appartamento in ristrutturazione. Tubi in multistrato.' },
    { titolo: 'Installazione Scalda Acqua', descrizione: 'Installazione boiler elettrico 80L con valvola di sicurezza e collaudo. Smaltimento vecchio.' },
    { titolo: 'Riparazione WC che Perde', descrizione: "Sostituzione meccanismo interno cassetta WC e guarnizioni. Risolto in meno di un'ora." },
    { titolo: 'Allaccio Lavatrice e Lavastoviglie', descrizione: 'Allaccio idraulico lavatrice e lavastoviglie con rubinetti di arresto e scarico dedicato.' },
  ],
  Elettricista: [
    { titolo: 'Impianto Elettrico Appartamento', descrizione: 'Rifacimento completo impianto elettrico con quadro moderno differenziali e prese a norma CEI 64-8.' },
    { titolo: 'Installazione Impianto Fotovoltaico', descrizione: 'Installazione 6kWp con inverter ibrido, sistema di accumulo e monitoraggio da app.' },
    { titolo: 'Installazione Climatizzatore', descrizione: 'Installazione split dual inverter con gas R32, foratura muro e collaudo con gas ecologico.' },
    { titolo: 'Sostituzione Quadro Elettrico', descrizione: 'Sostituzione quadro obsoleto con nuovo centralino con differenziali e salvavita separati per zona.' },
    { titolo: 'Punti Luce e Prese Aggiuntivi', descrizione: 'Aggiunta punti presa e luce in soggiorno e cucina. Passaggio cavi sotto traccia, intonaco incluso.' },
    { titolo: 'Impianto Domotica', descrizione: 'Installazione sistema domotico per controllo luci, tapparelle e riscaldamento da smartphone.' },
    { titolo: 'Videocitofono e Campanello', descrizione: 'Sostituzione videocitofono con modello Wi-Fi con telecamera HD e sblocco da remoto.' },
    { titolo: 'Colonnina Ricarica Auto Elettrica', descrizione: 'Installazione wallbox 11kW in garage con linea dedicata da quadro, certificazione MISE.' },
    { titolo: 'Riparazione Guasto Elettrico Urgente', descrizione: 'Diagnosi e riparazione guasto impianto elettrico. Intervento entro 2 ore, disponibile H24.' },
    { titolo: 'Impianto Illuminazione Esterna', descrizione: 'Installazione luci da giardino con cavi interrati, faretto LED e sensore crepuscolare.' },
  ],
  Imbianchino: [
    { titolo: 'Tinteggiatura Appartamento Completo', descrizione: 'Tinteggiatura 80mq: preparazione pareti, stucco, primer e due mani di pittura lavabile traspirante.' },
    { titolo: 'Rifacimento Intonaco Facciata', descrizione: 'Rasatura e tinteggiatura facciata esterna 200mq con pittura silossanica idrorepellente.' },
    { titolo: 'Verniciatura Infissi e Porte', descrizione: 'Levigatura, stuccatura e verniciatura porte interne e infissi in legno con prodotti a base acqua.' },
    { titolo: 'Carta da Parati Design', descrizione: 'Posa carta da parati in camera da letto con trattamento muri e levigatura. Precisione millimetrica.' },
    { titolo: 'Rasatura al Civile', descrizione: "Rasatura fine su tutta la superficie dell'appartamento per finitura liscia a specchio." },
    { titolo: 'Tinteggiatura Garage e Cantina', descrizione: 'Tinteggiatura pareti garage con pittura antimuffa e pavimento con smalto epossidico grigio.' },
    { titolo: 'Rifacimento Soffitto in Cartongesso', descrizione: 'Posa controsoffitto in cartongesso con incasso faretti LED e isolamento acustico.' },
    { titolo: 'Stucco Veneziano', descrizione: 'Applicazione stucco veneziano a due strati con effetto marmo. Finitura a cera e lucidatura.' },
  ],
  Muratore: [
    { titolo: 'Demolizione Parete Divisoria', descrizione: 'Abbattimento parete non portante, sgombero macerie, intonacatura e tinteggiatura bordi.' },
    { titolo: 'Posa Pavimento Gres Porcellanato', descrizione: 'Posa 60mq gres grande formato 120x60 su massetto autolivellante. Fughe con stuccatura epossidica.' },
    { titolo: 'Costruzione Muro di Contenimento', descrizione: 'Costruzione muro in mattoni pieni 25cm con fondamenta, intonaco e trattamento impermeabilizzante.' },
    { titolo: 'Rifacimento Massetto', descrizione: 'Demolizione pavimento esistente, nuovo massetto alleggerito con impianto radiante e livellatura.' },
    { titolo: 'Riparazione Crepe e Intonaco', descrizione: 'Ripristino crepe strutturali con resine epossidiche, stuccatura e rifacimento intonaco a tre strati.' },
    { titolo: 'Costruzione Barbecue in Muratura', descrizione: "Realizzazione barbecue in mattoni refrattari con piano cottura in pietra lavica e piano d'appoggio." },
    { titolo: 'Impermeabilizzazione Terrazzo', descrizione: 'Rifacimento impermeabilizzazione terrazza con guaina ardesiata e nuovo pavimento in gres.' },
    { titolo: 'Posa Piastrelle Bagno', descrizione: 'Posa rivestimento bagno 5mq con piastrelle grande formato, nicchie e bordi in acciaio satinato.' },
  ],
  Falegname: [
    { titolo: 'Cucina su Misura', descrizione: 'Progettazione e realizzazione cucina in rovere naturale con top in quarzo. Montaggio e assistenza post-vendita.' },
    { titolo: 'Armadio a Muro con Ante Scorrevoli', descrizione: 'Armadio su misura con ante in vetro acidato, interni organizzati e illuminazione LED interna.' },
    { titolo: 'Sostituzione Porte Interne', descrizione: 'Fornitura e posa porte interne in laminato rovere grigio con maniglie in acciaio. Compreso telaio.' },
    { titolo: 'Pavimento in Parquet', descrizione: 'Posa 50mq parquet prefinito rovere spazzolato 14mm con battiscopa abbinato. Flottante su schiuma.' },
    { titolo: 'Pergola in Legno di Pino', descrizione: 'Realizzazione pergola 4x5m in legno di pino impregnato con copertura in policarbonato ondulato.' },
    { titolo: 'Libreria a Muro su Misura', descrizione: 'Libreria in multistrato laccato bianco con scala scorrevole su binario. Illuminazione LED integrata.' },
    { titolo: 'Restauro Mobili Antichi', descrizione: 'Restauro tavolo e sedie antichi: smontaggio, trattamento tarli, riverniciatura a cera e rigenerazione.' },
    { titolo: 'Infissi in Legno Doppio Vetro', descrizione: 'Sostituzione infissi con telaio in legno di meranti verniciato e vetrocamera basso emissivo 4-16-4.' },
  ],
  Altro: [
    { titolo: 'Montaggio Mobili IKEA', descrizione: 'Montaggio e assemblaggio mobili con attrezzatura professionale. Nessun graffioo sui pavimenti.' },
    { titolo: 'Trasloco e Facchinaggio', descrizione: 'Trasloco appartamento con protezione mobili, smontaggio e rimontaggio. Furgone incluso.' },
    { titolo: 'Installazione Condizionatore', descrizione: 'Installazione split con ricerca guasti, ricarica gas e certificazione F-GAS.' },
    { titolo: 'Pulizia Straordinaria Appartamento', descrizione: 'Pulizia profonda post-cantiere o fine locazione. Prodotti professionali, risultato garantito.' },
    { titolo: 'Manutenzione Giardino', descrizione: 'Taglio erba, potatura siepi, pulizia foglie e trattamento antiparassitario piante.' },
    { titolo: 'Riparazione Elettrodomestici', descrizione: 'Diagnosi e riparazione lavatrice, lavastoviglie, frigorifero. Ricambi originali, garanzia 12 mesi.' },
  ],
};

// Make data available in templates
app.locals.CATEGORIE = CATEGORIE;
app.locals.SOTTOCATEGORIE = SOTTOCATEGORIE;
app.locals.ARTIGIANI = ARTIGIANI;

// ── Shared render helper for job pages ──
function renderPaginaLavoro(res, categoriaSlug, titoloSlug, locSlug, subcatSlug, subcat) {
  let artigianoTrovato = null;
  let lavoroTrovato = null;

  for (const art of Object.values(ARTIGIANI)) {
    for (const l of art.lavori) {
      const ts = slugify(l.titolo);
      if (ts === titoloSlug || ts.substring(0, 8) === titoloSlug.substring(0, 8)) {
        artigianoTrovato = art;
        lavoroTrovato = l;
        break;
      }
    }
    if (artigianoTrovato) break;
  }

  if (!artigianoTrovato) {
    return res.status(404).send('Pagina lavoro non trovata');
  }

  const titoloSeo = titoloSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const catSeo = categoriaSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const locSeo = locSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  res.render('pagina_lavoro', {
    artigiano: artigianoTrovato,
    lavoro: lavoroTrovato,
    titolo_seo: titoloSeo,
    cat_seo: catSeo,
    loc_seo: locSeo,
    categoria_slug: categoriaSlug,
    titolo_slug: titoloSlug,
    loc_slug: locSlug,
    artigiano_slug: artigianoTrovato.id,
    subcat_slug: subcatSlug || null,
    subcat: subcat || null,
  });
}

// ── Routes ──

app.get('/', (req, res) => {
  res.render('index', { categorie: CATEGORIE, sottocategorie: SOTTOCATEGORIE });
});

app.get('/cerca_attivita', (req, res) => {
  const q = (req.query.q || '').trim();
  const catFilter = (req.query.cat || '').trim();
  const citFilter = (req.query.cit || '').trim();
  const tutti = Object.values(ARTIGIANI);

  let filtrati;
  if (q || catFilter || citFilter) {
    const qLow = q.toLowerCase();
    const catLow = catFilter.toLowerCase();
    const citLow = citFilter.toLowerCase();
    filtrati = tutti.filter(a =>
      (!qLow || (a.nome || '').toLowerCase().includes(qLow) || (a.id || '').toLowerCase().includes(qLow)) &&
      (!catLow || (a.cat_slug || '').toLowerCase() === catLow) &&
      (!citLow || (a.citta || '').toLowerCase().includes(citLow))
    );
  } else {
    filtrati = tutti;
  }

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.render('cerca_attivita', {
    artigiani: tutti,
    artigiani_filtrati: filtrati,
    categorie: CATEGORIE,
    q_iniziale: q,
    cat_iniziale: catFilter,
    cit_iniziale: citFilter,
  });
});

// Also support legacy .php URL
app.get('/cerca_attivita.php', (req, res) => res.redirect(301, '/cerca_attivita'));

app.get('/scheda/:artigianoId', (req, res) => {
  const artigiano = ARTIGIANI[req.params.artigianoId];
  if (!artigiano) return res.status(404).send('Scheda non trovata');
  res.render('scheda', { artigiano });
});

app.get('/artigiano/:artigianoId/inserisci', (req, res) => {
  const artigiano = ARTIGIANI[req.params.artigianoId];
  if (!artigiano) return res.status(404).send('Artigiano non trovato');
  res.render('inserisci_lavoro', {
    artigiano,
    sottocategorie_json: JSON.stringify(SOTTOCATEGORIE),
  });
});

app.get('/api/esempi/:categoria', (req, res) => {
  const esempi = ESEMPI_PER_CATEGORIA[req.params.categoria] || ESEMPI_PER_CATEGORIA.Altro;
  res.json(esempi);
});

app.post('/api/lavoro/salva', (req, res) => {
  const data = req.body || {};
  const uploadsDir = path.join(__dirname, 'static', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const fotoData = data.foto_data || [null, null, null];
  const nomiFile = data.nomi_file || [null, null, null];
  const altTexts = data.alt_text || [null, null, null];
  const captions = data.caption || [null, null, null];

  const immaginiSalvate = [];
  for (let i = 0; i < fotoData.length; i++) {
    const b64 = fotoData[i];
    const nome = nomiFile[i];
    const alt = altTexts[i];
    const cap = captions[i];
    if (!b64 || !nome) continue;
    try {
      const raw = b64.includes(',') ? b64.split(',')[1] : b64;
      const imgBytes = Buffer.from(raw, 'base64');
      fs.writeFileSync(path.join(uploadsDir, nome), imgBytes);
      immaginiSalvate.push({
        url: `/static/uploads/${nome}`,
        nome_file: nome,
        alt: alt || `Foto lavoro ${i + 1}`,
        caption: cap || '',
        posizione: ['Principale', 'Dettaglio', 'Risultato'][i],
      });
    } catch (e) { /* skip */ }
  }

  const artigianoId = data.artigianoId || '';
  const titolo = (data.titolo || '').trim();
  const descrizione = (data.descrizione || '').trim();
  const citta = (data.citta || '').trim();
  const quartiere = (data.quartiere || '').trim();
  const sottocategoriaSlug = (data.sottocategoria_slug || '').trim();
  const sottocategoria = (data.sottocategoria || '').trim();

  const art = ARTIGIANI[artigianoId];
  let urlLavoro = '';
  if (art && titolo && citta) {
    const nuovoId = art.lavori.reduce((max, l) => Math.max(max, l.id || 0), 0) + 1;
    const nuovoLavoro = {
      id: nuovoId,
      titolo,
      descrizione,
      citta,
      quartiere,
      sottocategoria_slug: sottocategoriaSlug,
      sottocategoria,
      stelle: 5,
      visite: 0,
      recensione: '',
      cliente: '',
      data: new Date().toISOString().split('T')[0],
      immagini: immaginiSalvate,
    };
    art.lavori.push(nuovoLavoro);
    urlLavoro = buildJobUrl(art.cat_slug, nuovoLavoro);
  } else {
    urlLavoro = data.url || '';
  }

  res.json({
    success: true,
    message: 'Lavoro salvato con successo',
    immagini: immaginiSalvate,
    url_lavoro: urlLavoro,
  });
});

app.get('/manifest.json', (req, res) => {
  res.json({
    name: 'StelleVere',
    short_name: 'StelleVere',
    description: 'La tua scheda artigiano',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#f5c842',
    icons: [
      { src: '/static/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/static/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
});

app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const base = 'https://www.stellevere.it';

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    `  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ];

  for (const catSlug of Object.keys(CATEGORIE)) {
    lines.push(`  <url><loc>${base}/${catSlug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }

  const subcatCitta = {};
  for (const art of Object.values(ARTIGIANI)) {
    const csCat = art.cat_slug || '';
    for (const l of art.lavori) {
      const sc = l.sottocategoria_slug;
      if (sc) {
        const key = `${csCat}|${sc}`;
        if (!subcatCitta[key]) subcatCitta[key] = new Set();
        subcatCitta[key].add(slugify(l.citta || ''));
      }
    }
  }

  for (const catSlug of Object.keys(SOTTOCATEGORIE)) {
    for (const subcatSlug of Object.keys(SOTTOCATEGORIE[catSlug])) {
      lines.push(`  <url><loc>${base}/${catSlug}/${subcatSlug}</loc><changefreq>weekly</changefreq><priority>0.75</priority></url>`);
      const key = `${catSlug}|${subcatSlug}`;
      if (subcatCitta[key]) {
        for (const cs of subcatCitta[key]) {
          lines.push(`  <url><loc>${base}/${catSlug}/${subcatSlug}/${cs}</loc><changefreq>weekly</changefreq><priority>0.65</priority></url>`);
        }
      }
    }
  }

  const cittaPerCat = {};
  for (const art of Object.values(ARTIGIANI)) {
    for (const l of art.lavori) {
      const catSlug = art.cat_slug || '';
      if (!cittaPerCat[catSlug]) cittaPerCat[catSlug] = new Set();
      cittaPerCat[catSlug].add(slugify(l.citta || ''));
    }
  }
  for (const [catSlug, cittaSet] of Object.entries(cittaPerCat)) {
    for (const cs of cittaSet) {
      lines.push(`  <url><loc>${base}/${catSlug}/${cs}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
      lines.push(`  <url><loc>${base}/${catSlug}/${cs}/foto-lavori</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
    }
  }

  for (const art of Object.values(ARTIGIANI)) {
    const catSlug = art.cat_slug || 'altro';
    for (const l of art.lavori) {
      const ts = slugify(l.titolo);
      const cs = slugify(l.citta) + '-' + slugify(l.quartiere || '');
      const sc = l.sottocategoria_slug;
      const url = sc ? `${base}/${catSlug}/${sc}/${ts}/${cs}` : `${base}/${catSlug}/${ts}/${cs}`;
      const immagini = l.immagini || [];
      if (immagini.length) {
        lines.push('  <url>');
        lines.push(`    <loc>${url}</loc>`);
        lines.push('    <changefreq>monthly</changefreq><priority>0.6</priority>');
        for (const img of immagini) {
          lines.push('    <image:image>');
          lines.push(`      <image:loc>${base}/static/uploads/${img.file}</image:loc>`);
          lines.push(`      <image:title>${img.caption || ''}</image:title>`);
          lines.push(`      <image:caption>${img.alt || ''}</image:caption>`);
          lines.push('    </image:image>');
        }
        lines.push('  </url>');
      } else {
        lines.push(`  <url><loc>${url}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
      }
    }
  }

  lines.push('</urlset>');
  res.set('Content-Type', 'application/xml');
  res.send(lines.join('\n'));
});

// Photo gallery: /:cat/:city/foto-lavori
app.get('/:categoriaSlug/:cittaSlug/foto-lavori', (req, res) => {
  const { categoriaSlug, cittaSlug } = req.params;
  const cat = CATEGORIE[categoriaSlug];
  if (!cat) return res.status(404).send('Categoria non trovata');

  const tuttiJobs = buildJobsIndex();
  const jobs = jobsByCategoryCity(tuttiJobs, categoriaSlug, cittaSlug);

  const foto = [];
  for (const j of jobs) {
    for (const img of (j.immagini || [])) {
      foto.push({ ...img, lavoro: j, artigiano: j.artigiano });
    }
  }

  const cittaNome = cittaSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  res.render('galleria_foto', {
    cat, categoria_slug: categoriaSlug,
    citta_slug: cittaSlug, citta_nome: cittaNome,
    foto, n_lavori: jobs.length,
  });
});

// Category page: /:cat
app.get('/:categoriaSlug', (req, res) => {
  const { categoriaSlug } = req.params;
  const cat = CATEGORIE[categoriaSlug];
  if (!cat) return res.status(404).send('Categoria non trovata');

  const tuttiJobs = buildJobsIndex();
  const jobs = jobsByCategoryCity(tuttiJobs, categoriaSlug);

  const cittaCount = {};
  for (const j of jobs) {
    const c = j.citta || '';
    cittaCount[c] = (cittaCount[c] || 0) + 1;
  }
  const cittaList = Object.entries(cittaCount).sort((a, b) => b[1] - a[1]);

  const artigianiCat = Object.values(ARTIGIANI).filter(a => a.cat_slug === categoriaSlug);
  const sottocategorie = SOTTOCATEGORIE[categoriaSlug] || {};

  res.render('pagina_categoria', {
    cat, categoria_slug: categoriaSlug,
    jobs, citta_list: cittaList,
    artigiani: artigianiCat,
    sottocategorie,
  });
});

// 2-segment disambiguation: /:cat/:seg2
app.get('/:categoriaSlug/:seg2', (req, res) => {
  const { categoriaSlug, seg2 } = req.params;
  const cat = CATEGORIE[categoriaSlug];
  if (!cat) return res.status(404).send('Categoria non trovata');

  const subcatMap = SOTTOCATEGORIE[categoriaSlug] || {};

  if (subcatMap[seg2]) {
    // Subcategory page
    const subcatSlug = seg2;
    const subcat = subcatMap[subcatSlug];
    const tuttiJobs = buildJobsIndex();
    const jobs = jobsBySubcat(tuttiJobs, categoriaSlug, subcatSlug);

    const cittaCount = {};
    for (const j of jobs) {
      const cs = slugify(j.citta || '');
      cittaCount[cs] = (cittaCount[cs] || 0) + 1;
    }
    const cittaList = Object.entries(cittaCount).sort((a, b) => b[1] - a[1]);

    res.render('pagina_sottocategoria', {
      cat, categoria_slug: categoriaSlug,
      subcat, subcat_slug: subcatSlug,
      citta_slug: null, citta_nome: null,
      jobs, citta_list: cittaList,
      quart_list: [],
    });
  } else {
    // City page
    const cittaSlug = seg2;
    const tuttiJobs = buildJobsIndex();
    const jobs = jobsByCategoryCity(tuttiJobs, categoriaSlug, cittaSlug);

    const quartCount = {};
    for (const j of jobs) {
      if (j.quartiere) quartCount[j.quartiere] = (quartCount[j.quartiere] || 0) + 1;
    }
    const quartList = Object.entries(quartCount).sort((a, b) => b[1] - a[1]);

    const cittaNome = cittaSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const artigianiCitta = Object.values(ARTIGIANI).filter(a =>
      a.cat_slug === categoriaSlug && slugify(a.citta || '') === cittaSlug
    );

    res.render('pagina_citta', {
      cat, categoria_slug: categoriaSlug,
      citta_slug: cittaSlug, citta_nome: cittaNome,
      jobs, quart_list: quartList,
      artigiani: artigianiCitta,
    });
  }
});

// 3-segment disambiguation: /:cat/:seg2/:seg3
app.get('/:categoriaSlug/:seg2/:seg3', (req, res) => {
  const { categoriaSlug, seg2, seg3 } = req.params;
  const cat = CATEGORIE[categoriaSlug];
  if (!cat) return res.status(404).send('Categoria non trovata');

  const subcatMap = SOTTOCATEGORIE[categoriaSlug] || {};

  if (subcatMap[seg2]) {
    // Subcategory + city page
    const subcatSlug = seg2;
    const cittaSlug = seg3;
    const subcat = subcatMap[subcatSlug];
    const tuttiJobs = buildJobsIndex();
    const jobs = jobsBySubcat(tuttiJobs, categoriaSlug, subcatSlug, cittaSlug);

    const cittaNome = cittaSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const quartCount = {};
    for (const j of jobs) {
      if (j.quartiere) quartCount[j.quartiere] = (quartCount[j.quartiere] || 0) + 1;
    }
    const quartList = Object.entries(quartCount).sort((a, b) => b[1] - a[1]);

    // Build city list for all jobs in this subcat
    const allJobs = buildJobsIndex();
    const cittaCount = {};
    for (const j of allJobs) {
      if (j.artigiano.cat_slug === categoriaSlug && j.sottocategoria_slug === subcatSlug) {
        const cs = slugify(j.citta || '');
        cittaCount[cs] = (cittaCount[cs] || 0) + 1;
      }
    }
    const cittaList = Object.entries(cittaCount).sort((a, b) => b[1] - a[1]);

    res.render('pagina_sottocategoria', {
      cat, categoria_slug: categoriaSlug,
      subcat, subcat_slug: subcatSlug,
      citta_slug: cittaSlug, citta_nome: cittaNome,
      jobs, citta_list: cittaList,
      quart_list: quartList,
    });
  } else {
    // Legacy 3-segment job page
    renderPaginaLavoro(res, categoriaSlug, seg2, seg3);
  }
});

// 4-segment job page: /:cat/:subcat/:title/:loc
app.get('/:categoriaSlug/:subcatSlug/:titoloSlug/:locSlug', (req, res) => {
  const { categoriaSlug, subcatSlug, titoloSlug, locSlug } = req.params;
  const cat = CATEGORIE[categoriaSlug];
  if (!cat) return res.status(404).send('Categoria non trovata');

  const subcatMap = SOTTOCATEGORIE[categoriaSlug] || {};
  if (!subcatMap[subcatSlug]) return res.status(404).send('Sottocategoria non trovata');

  const subcat = subcatMap[subcatSlug];
  renderPaginaLavoro(res, categoriaSlug, titoloSlug, locSlug, subcatSlug, subcat);
});

// ── Start ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`StelleVere running on http://localhost:${PORT}`);
});
