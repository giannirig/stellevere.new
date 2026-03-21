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
```
