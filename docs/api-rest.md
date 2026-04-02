# API REST StelleVere

Base URL locale:

```text
http://localhost:5001
```

Base URL produzione:

```text
https://stellevere.it
```

## Formato Risposte

Tutte le risposte sono in JSON.

Esempio standard:

```json
{
  "success": true,
  "count": 2,
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3
  },
  "items": []
}
```

Errore standard:

```json
{
  "success": false,
  "message": "Descrizione errore"
}
```

## Autenticazione

Gli endpoint di sola lettura sono pubblici.

Gli endpoint di scrittura richiedono una API key:

- header `x-api-key`
- oppure parametro `api_key`

Variabili ambiente:

```env
API_WRITE_KEY=...
API_ADMIN_KEY=...
```

## Paginazione

Gli endpoint lista supportano:

- `page`
- `per_page`

Esempio:

```text
/api/lavori?page=2&per_page=10
```

## Endpoint

### GET /api/artigiani

Restituisce gli artigiani filtrabili per ricerca, categoria e zona.

Query params:

- `q`
- `categoria`
- `citta`
- `quartiere`
- `page`
- `per_page`

Esempio:

```text
/api/artigiani?q=doccia&categoria=idraulica&citta=Roma&page=1&per_page=20
```

Risposta:

```json
{
  "success": true,
  "count": 1,
  "filters": {
    "q": "doccia",
    "categoria": "idraulica",
    "citta": "Roma",
    "quartiere": ""
  },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "total_pages": 1
  },
  "items": [
    {
      "slug": "idratest",
      "nome": "Idratest",
      "telefono": "391 156 6400",
      "categoria": {
        "slug": "idraulica",
        "nome": "Idraulica"
      },
      "citta": "Roma",
      "quartiere": "",
      "indirizzo": "Via Milano, 58, 00199 Roma RM",
      "rating_avg": 4.8,
      "reviews_count": 3,
      "jobs_count": 5,
      "profile_url": "/artigiano/idratest"
    }
  ]
}
```

### GET /api/artigiani/:slug

Restituisce il dettaglio pubblico di un artigiano e i suoi lavori.

Esempio:

```text
/api/artigiani/idratest
```

### GET /api/lavori

Restituisce i lavori pubblicati, con ricerca semantica e filtri.

Query params:

- `q`
- `categoria`
- `citta`
- `quartiere`
- `artigiano`
- `page`
- `per_page`

Esempio:

```text
/api/lavori?q=caldaia&categoria=idraulica&citta=roma&page=1&per_page=20
```

Risposta:

```json
{
  "success": true,
  "count": 1,
  "filters": {
    "q": "caldaia",
    "categoria": "idraulica",
    "citta": "roma",
    "quartiere": "",
    "artigiano": ""
  },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "total_pages": 1
  },
  "items": [
    {
      "slug": "sostituzione-caldaia-a-condensazione-roma-1774339190198",
      "titolo": "Sostituzione Caldaia a Condensazione",
      "descrizione": "Sostituzione caldaia murale...",
      "categoria": {
        "slug": "idraulica",
        "nome": "Idraulica"
      },
      "tipo": {
        "slug": "sostituzione-caldaia",
        "nome": "Sostituzione Caldaia a Condensazione"
      },
      "citta": "Roma",
      "quartiere": "Salario",
      "artigiano": {
        "slug": "idratest",
        "nome": "Idratest",
        "profile_url": "/artigiano/idratest"
      },
      "rating_avg": 0,
      "reviews_count": 0,
      "cover_path": "v2-lavori/idratest-....jpg",
      "detail_url": "/idraulica/sostituzione-caldaia/roma/salario/idratest"
    }
  ]
}
```

### GET /api/lavori/:artigianoSlug/:lavoroSlug

Restituisce il dettaglio di un lavoro specifico.

Esempio:

```text
/api/lavori/idratest/sostituzione-caldaia-a-condensazione-roma-1774339190198
```

### GET /api/recensioni

Restituisce le recensioni pubblicate più recenti.

Query params:

- `page`
- `per_page`

Esempio:

```text
/api/recensioni?page=1&per_page=20
```

### POST /api/lavori

Crea un nuovo lavoro tramite API.

Autenticazione:

- `x-api-key: API_WRITE_KEY`

Body JSON:

```json
{
  "artigiano_slug": "idratest",
  "categoria_slug": "idraulica",
  "titolo": "Sostituzione rubinetto cucina",
  "descrizione": "Sostituzione miscelatore cucina e verifica finale della tenuta.",
  "citta": "Roma",
  "quartiere": "Salario",
  "cliente_whatsapp": "3911566400",
  "lat": 41.9326,
  "lng": 12.4994,
  "immagini": [
    {
      "src": "data:image/jpeg;base64,...",
      "name": "rubinetto-1.jpg"
    }
  ]
}
```

Risposta:

```json
{
  "success": true,
  "lavoro": {
    "slug": "sostituzione-rubinetto-cucina-roma-1770000000000",
    "titolo": "Sostituzione rubinetto cucina",
    "detail_url": "/idraulica/sostituzione-rubinetto/roma/salario/idratest"
  }
}
```

Possibili errori:

- `400` payload incompleto o non valido
- `401` API key non valida
- `402` limite piano raggiunto

### POST /api/recensioni

Crea una recensione per un lavoro esistente.

Autenticazione:

- `x-api-key: API_WRITE_KEY`

Body JSON:

```json
{
  "artigiano_slug": "idratest",
  "lavoro_slug": "sostituzione-caldaia-a-condensazione-roma-1774339190198",
  "cliente_nome": "Mario Rossi",
  "voto": 5,
  "testo": "Lavoro preciso, puntuale e pulito."
}
```

Risposta:

```json
{
  "success": true
}
```

### POST /api/claims

Avvia una richiesta di claim.

Body JSON:

```json
{
  "artigiano_id": 12,
  "telefono": "3911566400",
  "metodo": "sms"
}
```

### GET /api/admin/overview

Restituisce dati aggregati minimi per pannelli admin.

Autenticazione:

- `x-api-key: API_ADMIN_KEY`

Risposta:

```json
{
  "success": true,
  "totals": {
    "artigiani": 508,
    "lavori": 120,
    "recensioni": 46
  }
}
```

## Note Implementative

- In locale l'app può lavorare anche senza MySQL, grazie ai fallback JSON.
- In produzione è consigliato usare solo MySQL come sorgente dati principale.
- Le immagini nel `POST /api/lavori` sono accettate come data URI base64.
- Il widget del sito artigiano può leggere i dati direttamente da questi endpoint in una fase successiva.
