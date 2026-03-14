# Stellevere

Website for stellevere.it, imported from GitHub (`giannirig/stellevere.it`).

## Project Structure

- `main.py` — Flask application entry point
- `templates/` — Jinja2 HTML templates
- `static/` — Static assets (CSS, JS, images)
  - `static/css/style.css` — Main stylesheet
  - `static/js/main.js` — Main JavaScript
- `pyproject.toml` — Python project config and dependencies

## Tech Stack

- **Language:** Python 3.11
- **Framework:** Flask
- **Production server:** Gunicorn
- **Port:** 5000

## Running the App

Development:
```bash
python main.py
```

Production:
```bash
gunicorn --bind=0.0.0.0:5000 --reuse-port main:app
```

## Notes

- The original GitHub repository only contained a `test` file at import time.
- A placeholder Flask website was created as the starting point.
- The site content (`templates/index.html`) should be updated with actual content.
