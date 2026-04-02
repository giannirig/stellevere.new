INSERT INTO categorie (slug, nome) VALUES
  ('idraulica', 'Idraulica'),
  ('elettricista', 'Elettricista'),
  ('imbianchino', 'Imbianchino'),
  ('muratore', 'Muratore'),
  ('falegname', 'Falegname'),
  ('altro', 'Altro');

INSERT INTO tipi_intervento (categoria_id, slug, nome)
SELECT c.id, v.slug, v.nome
FROM categorie c
JOIN (
  SELECT 'idraulica' AS categoria_slug, 'sostituzione-rubinetto' AS slug, 'Sostituzione rubinetto' AS nome
  UNION ALL SELECT 'idraulica', 'installazione-scaldabagno', 'Installazione scaldabagno'
  UNION ALL SELECT 'idraulica', 'sostituzione-caldaia', 'Sostituzione caldaia'
  UNION ALL SELECT 'idraulica', 'rifacimento-bagno', 'Rifacimento bagno'
  UNION ALL SELECT 'idraulica', 'riparazione-perdita', 'Riparazione perdita'
  UNION ALL SELECT 'elettricista', 'rifacimento-impianto', 'Rifacimento impianto elettrico'
  UNION ALL SELECT 'elettricista', 'installazione-climatizzatore', 'Installazione climatizzatore'
  UNION ALL SELECT 'elettricista', 'sostituzione-quadro', 'Sostituzione quadro elettrico'
  UNION ALL SELECT 'elettricista', 'installazione-fotovoltaico', 'Installazione fotovoltaico'
  UNION ALL SELECT 'imbianchino', 'tinteggiatura-interni', 'Tinteggiatura interni'
  UNION ALL SELECT 'imbianchino', 'tinteggiatura-esterni', 'Tinteggiatura esterni'
  UNION ALL SELECT 'muratore', 'posa-pavimenti', 'Posa pavimenti'
  UNION ALL SELECT 'muratore', 'ristrutturazione-completa', 'Ristrutturazione completa'
  UNION ALL SELECT 'muratore', 'impermeabilizzazione', 'Impermeabilizzazione'
  UNION ALL SELECT 'falegname', 'cucina-su-misura', 'Cucina su misura'
  UNION ALL SELECT 'falegname', 'armadio-su-misura', 'Armadio su misura'
  UNION ALL SELECT 'altro', 'montaggio-mobili', 'Montaggio mobili'
  UNION ALL SELECT 'altro', 'manutenzione-giardino', 'Manutenzione giardino'
) v ON v.categoria_slug = c.slug;

INSERT INTO subscription_plans (slug, nome, prezzo_mensile, max_lavori) VALUES
  ('free', 'Free', 0.00, 5),
  ('base', 'Base', 9.90, 10),
  ('pro', 'Pro', 19.90, 25),
  ('unlimited', 'Unlimited', 39.90, NULL);
