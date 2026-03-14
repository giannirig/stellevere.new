# Stellevere

Sito web per stellevere.it, importato da GitHub (`giannirig/stellevere.it`).

## Struttura del Progetto

- `main.py` — Punto di ingresso dell'applicazione Flask
- `templates/` — Template HTML con Jinja2
- `static/` — Risorse statiche (CSS, JS, immagini)
  - `static/css/style.css` — Foglio di stile principale
  - `static/js/main.js` — JavaScript principale
- `pyproject.toml` — Configurazione del progetto Python e dipendenze

## Stack Tecnologico

- **Linguaggio:** Python 3.11
- **Framework:** Flask
- **Server di produzione:** Gunicorn
- **Porta:** 5000

## Avviare l'Applicazione

Sviluppo:
```bash
python main.py
```

Produzione:
```bash
gunicorn --bind=0.0.0.0:5000 --reuse-port main:app
```

## Note

- Il repository GitHub originale conteneva solo un file `test` al momento dell'importazione.
- È stato creato un sito Flask di base come punto di partenza.
- Il contenuto del sito (`templates/index.html`) va aggiornato con il contenuto reale.
