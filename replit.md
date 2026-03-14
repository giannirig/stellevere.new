# StelleVere

Directory di artigiani italiani verificati — "Stelle vere, non comprate".

## Struttura del Progetto

- `main.py` — Applicazione Flask con tutte le route
- `templates/`
  - `index.html` — Homepage con link demo
  - `scheda.html` — Scheda pubblica dell'artigiano (per clienti, desktop + mobile)
  - `inserisci_lavoro.html` — Inserimento lavori per l'artigiano (ottimizzato smartphone)
- `static/`
  - `css/style.css` — Stile base
  - `js/main.js` — JavaScript base
  - `icons/` — Icone PWA per installazione su smartphone

## Stack Tecnologico

- **Linguaggio:** Python 3.11
- **Framework:** Flask
- **Server di produzione:** Gunicorn
- **Porta:** 5000
- **Stile:** Dark theme, Inter font, oro #f5c842

## Route principali

- `/` — Homepage
- `/scheda/<artigiano_id>` — Scheda pubblica artigiano
- `/artigiano/<artigiano_id>/inserisci` — Inserimento lavoro (artigiano da smartphone)
- `/api/esempi/<categoria>` — JSON esempi per categoria
- `/api/lavoro/salva` — Salvataggio lavoro (POST)
- `/manifest.json` — Manifest PWA

## Funzionalità Inserimento Lavori

- Esempi simili copiabili con un tap
- Categoria lavoro (6 tipi)
- Titolo + descrizione con contatore caratteri
- 3 foto dalla fotocamera
- Localizzazione: città + quartiere + GPS automatico con mappa
- Richiesta recensione WhatsApp al cliente con un tap
- Installabile come PWA (icona su smartphone)

## Avviare l'Applicazione

Sviluppo:
```bash
python main.py
```

Produzione:
```bash
gunicorn --bind=0.0.0.0:5000 --reuse-port main:app
```
