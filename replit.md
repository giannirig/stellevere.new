# StelleVere

Directory di artigiani italiani verificati — "Stelle vere, non comprate".

## Struttura del Progetto

- `main.py` — Applicazione Flask con tutte le route, dati ARTIGIANI/CATEGORIE, helper slugify
- `templates/`
  - `index.html` — Homepage con link demo
  - `scheda.html` — Scheda pubblica dell'artigiano
  - `inserisci_lavoro.html` — Inserimento lavori per l'artigiano (ottimizzato smartphone)
  - `pagina_lavoro.html` — Pagina SEO singolo lavoro (indicizzabile Google)
  - `pagina_categoria.html` — Directory per categoria (es. /idraulica)
  - `pagina_citta.html` — Directory per città dentro categoria (es. /idraulica/milano)
- `static/`
  - `icons/` — Icone PWA

## Stack Tecnologico

- **Linguaggio:** Python 3.11
- **Framework:** Flask
- **Server:** Gunicorn su porta 5000
- **Stile:** Dark theme (#0a0a0a), Inter font, oro #f5c842, verde WhatsApp #25d366

## Route e struttura URL

```
/                                       Homepage
/scheda/<id>                            Scheda pubblica artigiano
/artigiano/<id>/inserisci               Inserimento lavori (smartphone)
/api/esempi/<categoria>                 JSON esempi per categoria
/api/lavoro/salva                       POST salva lavoro
/manifest.json                          PWA manifest

# Directory SEO (generate automaticamente dai lavori pubblicati)
/<categoria>                            Pagina categoria (es. /idraulica)
/<categoria>/<citta>                    Pagina città (es. /idraulica/milano)
/<categoria>/<titolo>/<citta-quartiere> Pagina singolo lavoro
```

## Dati in memoria (mock)

- **ARTIGIANI** — 7 artigiani: Fossati, Ricci (idraulici Milano), Ferrari (elettricista Milano), Bianchi (elettricista Roma), Esposito (imbianchino Roma), Russo (muratore Milano), De Luca (idraulico Roma)
- **CATEGORIE** — dict slug→nome/cat_tipo/plurale/icona
- **ESEMPI_PER_CATEGORIA** — 8–10 esempi realistici per categoria
- **slugify()** — helper globale per costruire gli slug URL

## Funzionalità

- Inserimento lavori: categoria → esempi → form 5 campi → WhatsApp recensione → pubblica
- Pagine directory auto-generate per categoria e città con filtro quartiere
- Schema.org JSON-LD + canonical + breadcrumb su tutte le pagine lavoro e directory
- Filtro quartiere interattivo con JS (no librerie esterne)
- Badge "Verificato" su tutti gli artigiani

## Avviare l'Applicazione

```bash
python main.py       # sviluppo
gunicorn --bind=0.0.0.0:5000 --reuse-port main:app   # produzione
```
