# Esempi cURL API StelleVere

Base URL locale:

```text
http://localhost:5001
```

Sostituisci `YOUR_WRITE_KEY` e `YOUR_ADMIN_KEY` con le chiavi reali del file `.env`.

## Artigiani

### Lista artigiani

```bash
curl "http://localhost:5001/api/artigiani?page=1&per_page=20"
```

### Ricerca artigiani per categoria e città

```bash
curl "http://localhost:5001/api/artigiani?q=doccia&categoria=idraulica&citta=Roma&page=1&per_page=20"
```

### Dettaglio artigiano

```bash
curl "http://localhost:5001/api/artigiani/idratest"
```

## Lavori

### Lista lavori

```bash
curl "http://localhost:5001/api/lavori?page=1&per_page=20"
```

### Ricerca lavori per categoria e città

```bash
curl "http://localhost:5001/api/lavori?q=caldaia&categoria=idraulica&citta=roma&page=1&per_page=20"
```

### Ricerca lavori per artigiano

```bash
curl "http://localhost:5001/api/lavori?artigiano=idratest&page=1&per_page=20"
```

### Dettaglio lavoro

```bash
curl "http://localhost:5001/api/lavori/idratest/sostituzione-caldaia-a-condensazione-roma-1774339190198"
```

## Recensioni

### Lista recensioni

```bash
curl "http://localhost:5001/api/recensioni?page=1&per_page=20"
```

## Creazione lavoro

### POST /api/lavori

```bash
curl -X POST "http://localhost:5001/api/lavori" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: YOUR_WRITE_KEY" ^
  -d "{\"artigiano_slug\":\"idratest\",\"categoria_slug\":\"idraulica\",\"titolo\":\"Sostituzione rubinetto cucina\",\"descrizione\":\"Sostituzione miscelatore cucina e verifica finale della tenuta.\",\"citta\":\"Roma\",\"quartiere\":\"Salario\",\"cliente_whatsapp\":\"3911566400\",\"lat\":41.9326,\"lng\":12.4994,\"immagini\":[{\"src\":\"data:image/jpeg;base64,...\",\"name\":\"rubinetto-1.jpg\"}]}"
```

## Creazione recensione

### POST /api/recensioni

```bash
curl -X POST "http://localhost:5001/api/recensioni" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: YOUR_WRITE_KEY" ^
  -d "{\"artigiano_slug\":\"idratest\",\"lavoro_slug\":\"sostituzione-caldaia-a-condensazione-roma-1774339190198\",\"cliente_nome\":\"Mario Rossi\",\"voto\":5,\"testo\":\"Lavoro preciso, puntuale e pulito.\"}"
```

## Claim

### POST /api/claims

```bash
curl -X POST "http://localhost:5001/api/claims" ^
  -H "Content-Type: application/json" ^
  -d "{\"artigiano_id\":12,\"telefono\":\"3911566400\",\"metodo\":\"sms\"}"
```

## Admin

### GET /api/admin/overview

```bash
curl "http://localhost:5001/api/admin/overview" ^
  -H "x-api-key: YOUR_ADMIN_KEY"
```
