# StelleVere

Directory di artigiani italiani verificati — "Stelle vere, non comprate".

## Struttura del Progetto

- `server.js` — Applicazione Express: route, dati ARTIGIANI/CATEGORIE/SOTTOCATEGORIE, helper slugify/buildJobUrl
- `views/`
  - `index.ejs` — Homepage
  - `scheda.ejs` — Scheda pubblica artigiano
  - `inserisci_lavoro.ejs` — PWA inserimento lavori (ottimizzato smartphone)
  - `pagina_lavoro.ejs` — Pagina SEO singolo lavoro (3-seg o 4-seg)
  - `pagina_categoria.ejs` — Directory categoria con griglia sottocategorie
  - `pagina_sottocategoria.ejs` — Directory sottocategoria (e subcat+città)
  - `pagina_citta.ejs` — Directory città dentro categoria
  - `galleria_foto.ejs` — Galleria foto lavori per categoria+città
  - `cerca_attivita.ejs` — Cerca attività / artigiani
- `static/`
  - `icons/` — Icone PWA
  - `uploads/` — Foto lavori caricate dagli artigiani

## Stack Tecnologico

- **Linguaggio:** Node.js
- **Framework:** Express + EJS
- **Database:** MySQL/MariaDB opzionale via env (`mysql2`) con fallback ai dati locali
- **Server:** Node.js su porta 5000
- **Stile:** Dark theme (#0a0a0a), Inter font, oro #f5c842, verde WhatsApp #25d366

## Route e struttura URL (4 livelli)

```
/                                                 Homepage
/scheda/<id>                                      Scheda pubblica artigiano
/artigiano/<id>/inserisci                         Inserimento lavori (smartphone)
/api/esempi/<categoria>                           JSON esempi per categoria
/api/lavoro/salva                                 POST salva lavoro
/manifest.json                                    PWA manifest
/sitemap.xml                                      Sitemap con image tags Google

# Directory SEO — generate automaticamente dai lavori pubblicati
/<categoria>                                      Pagina categoria + griglia sottocategorie
/<categoria>/<sottocategoria>                     Pagina sottocategoria
/<categoria>/<sottocategoria>/<citta>             Pagina sottocategoria + città
/<categoria>/<sottocategoria>/<titolo>/<loc>      Pagina lavoro 4-livelli (NUOVO default)
/<categoria>/<titolo>/<citta-quartiere>           Pagina lavoro 3-livelli (backward compat)
/<categoria>/<citta>                              Pagina città
/<categoria>/<citta>/foto-lavori                  Galleria foto
```

**Disambiguazione route 2-seg:** il secondo segmento viene verificato contro SOTTOCATEGORIE[cat] per decidere se è una sottocategoria o una città.
**Disambiguazione route 3-seg:** se il secondo segmento è una sottocategoria → subcat+città; altrimenti → vecchia pagina lavoro (compatibilità).

## Dati in memoria

- **ARTIGIANI** — 7 artigiani: Fossati, Ricci (idraulici Milano), Ferrari (elettricista Milano), Bianchi (elettricista Roma), Esposito (imbianchino Roma), Russo (muratore Milano), De Luca (idraulico Roma)
- **CATEGORIE** — dict slug→nome/cat_tipo/plurale/icona
- **SOTTOCATEGORIE** — dict cat_slug→{subcat_slug→{nome,desc}} (6 categorie, 4–6 subcat ciascuna, ~30 subcat totali)
- **ESEMPI_PER_CATEGORIA** — 8–10 esempi realistici per categoria
- **helper:** `slugify()`, `buildJobsIndex()`, `jobsByCategoryCity()`, `jobsBySubcat()`, `buildJobUrl()`, `renderPaginaLavoro()`

## Ogni lavoro ha `sottocategoria_slug`

Tutti i lavori in ARTIGIANI hanno il campo `sottocategoria_slug` che determina:
1. Il livello 2 dell'URL (4-seg URL)
2. Il filtro nella pagina sottocategoria
3. Il badge nell'elenco lavori

## Sitemap XML

81 URL inclusi:
- Pagine categoria (×6)
- Pagine sottocategoria (~30)
- Pagine sottocategoria+città (generate da lavori reali)
- Pagine città + gallerie foto
- Pagine singoli lavori con `<image:image>` tags Google

## Avviare l'Applicazione

```bash
npm run dev      # sviluppo (con --watch)
npm start        # produzione
npm run dev:v2   # nuova base V2
npm run start:v2 # avvio V2
```

## Configurazione Database

Se l'app gira nello stesso ambiente del database Hostinger, puoi configurare:

```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nome_database
DB_USER=nome_utente
DB_PASSWORD=password_database
```

L'app tenta il caricamento da MySQL all'avvio e continua con il fallback locale se il database non è raggiungibile o se manca la configurazione.

## Configurazione Produzione Hostinger

Per un deploy Node.js su Hostinger conviene usare un file `.env` derivato da `.env.example` con almeno:

```bash
NODE_ENV=production
PORT=5001
APP_BASE_URL=https://tuodominio.it

DB_HOST=localhost
DB_PORT=3306
DB_NAME=nome_database
DB_USER=nome_utente
DB_PASSWORD=password_database

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_PHONE=...

SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...

API_WRITE_KEY=...
API_ADMIN_KEY=...
```

Flusso consigliato:

1. clonare il repository su Hostinger via Git
2. creare `.env` sul server
3. eseguire `npm install`
4. importare `sql/schema.sql`
5. avviare `src/app.js` tramite Node.js o PM2
6. collegare il dominio a `APP_BASE_URL`

## Nuova Base V2

Per la riscrittura ordinata del progetto sono stati aggiunti:

- `sql/schema.sql` — schema MySQL completo database-first
- `sql/seed-categorie.sql` — categorie e tipi intervento iniziali
- `src/app.js` — entrypoint della nuova architettura
- `src/config/` — env, db e Twilio
- `src/repositories/` — accesso ai dati
- `src/modules/` — servizi per artigiani, lavori, recensioni, claim, admin, SEO, mappe
- `src/routes/` — route pubbliche, dashboard, admin e API
- `src/views/` — template EJS della nuova base

### Primo blocco V2 già pronto

- home V2 collegata al database
- scheda pubblica artigiano su `/artigiano/:slug`
- script import artigiani legacy:

```bash
npm run import:artigiani:v2
```

Prima dell'import conviene eseguire:

```bash
mysql -u USER -p DB_NAME < sql/schema.sql
mysql -u USER -p DB_NAME < sql/seed-categorie.sql
```

### Claim scheda V2

La V2 ora supporta anche:

- CTA pubblica "Rivendica questa scheda"
- scelta canale automatica:
  - cellulare -> OTP via SMS
  - fisso -> OTP via messaggio vocale
- persistenza su `artigiano_claims` e `otp_codes` quando MySQL è disponibile
- fallback demo locale quando DB o Twilio non sono raggiungibili

Variabili ambiente Twilio:

```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_PHONE=...
```

### Dashboard V2

La dashboard artigiano ora prevede:

- profilo attività modificabile
- limiti piano lavori:
  - free: 5 lavori
  - base: 10 lavori a 9,90/mese
  - pro: 25 lavori a 19,90/mese
  - unlimited: lavori illimitati a 39,90/mese
- bundle sito web:
  - attivazione sito a 299 euro
  - include piano base fino a 10 lavori per 12 mesi
- salvataggio profilo:
  - su MySQL V2 quando il database è disponibile
  - su fallback locale in `data/dashboard-profiles.json` quando il DB non è raggiungibile
- pubblicazione lavori con controllo piano:
  - free: massimo 5 lavori
  - base: massimo 10 lavori
  - pro: massimo 25 lavori
  - unlimited: nessun limite
  - campi V2: titolo, categoria, tipo intervento, città, quartiere, indirizzo, latitudine, longitudine, descrizione
  - salvataggio su tabella `lavori` quando MySQL è disponibile
  - fallback locale in `data/dashboard-jobs.json` quando il DB non è raggiungibile

URL demo locali:

- `/dashboard/:slug`
- `/dashboard/:slug/lavori/nuovo`

## API REST V2

La V2 espone anche API REST pubbliche e protette:

- `GET /api/artigiani`
- `GET /api/artigiani/:slug`
- `GET /api/lavori`
- `GET /api/lavori/:artigianoSlug/:lavoroSlug`
- `GET /api/recensioni`
- `POST /api/lavori`
- `POST /api/recensioni`
- `POST /api/claims`
- `GET /api/admin/overview`

Documentazione completa:

- [docs/api-rest.md](C:/Users/PC/Documents/stellevereit/docs/api-rest.md)
- [curl-examples.md](C:/Users/PC/Documents/stellevereit/docs/curl-examples.md)
- [postman-stellevere-v2.collection.json](C:/Users/PC/Documents/stellevereit/docs/postman-stellevere-v2.collection.json)
