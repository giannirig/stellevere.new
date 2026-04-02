CREATE TABLE categorie (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tipi_intervento (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  slug VARCHAR(120) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tipi_categoria_slug (categoria_id, slug),
  CONSTRAINT fk_tipi_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorie(id)
    ON DELETE CASCADE
);

CREATE TABLE artigiani (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  nome VARCHAR(160) NOT NULL,
  ragione_sociale VARCHAR(200) NULL,
  source ENUM('google_maps', 'manual', 'claim') NOT NULL DEFAULT 'google_maps',
  telefono VARCHAR(40) NOT NULL,
  telefono_tipo ENUM('mobile', 'landline', 'unknown') NOT NULL DEFAULT 'unknown',
  categoria_principale_id INT NOT NULL,
  citta_principale VARCHAR(120) NULL,
  quartiere_principale VARCHAR(120) NULL,
  sede_legale VARCHAR(255) NULL,
  orari_lavoro JSON NULL,
  bio TEXT NULL,
  sito_web VARCHAR(255) NULL,
  facebook_url VARCHAR(255) NULL,
  instagram_url VARCHAR(255) NULL,
  tiktok_url VARCHAR(255) NULL,
  claim_status ENUM('unclaimed', 'pending', 'claimed', 'blocked') NOT NULL DEFAULT 'unclaimed',
  otp_channel ENUM('sms', 'voice') NULL,
  website_enabled TINYINT(1) NOT NULL DEFAULT 0,
  website_activated_at DATETIME NULL,
  rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0,
  reviews_count INT NOT NULL DEFAULT 0,
  jobs_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_artigiani_categoria
    FOREIGN KEY (categoria_principale_id) REFERENCES categorie(id)
);

CREATE TABLE artigiano_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artigiano_id INT NOT NULL,
  telefono_verificato VARCHAR(40) NOT NULL,
  metodo_claim ENUM('sms', 'voice', 'manual') NOT NULL,
  stato ENUM('pending', 'verified', 'failed', 'expired') NOT NULL DEFAULT 'pending',
  verificato_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_artigiano
    FOREIGN KEY (artigiano_id) REFERENCES artigiani(id)
    ON DELETE CASCADE
);

CREATE TABLE otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artigiano_id INT NOT NULL,
  claim_id INT NULL,
  channel ENUM('sms', 'voice') NOT NULL,
  codice VARCHAR(12) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  attempts_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_otp_artigiano
    FOREIGN KEY (artigiano_id) REFERENCES artigiani(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_otp_claim
    FOREIGN KEY (claim_id) REFERENCES artigiano_claims(id)
    ON DELETE SET NULL
);

CREATE TABLE lavori (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artigiano_id INT NOT NULL,
  categoria_id INT NOT NULL,
  tipo_intervento_id INT NOT NULL,
  slug VARCHAR(180) NOT NULL,
  titolo VARCHAR(180) NOT NULL,
  descrizione TEXT NOT NULL,
  citta VARCHAR(120) NOT NULL,
  quartiere VARCHAR(120) NULL,
  indirizzo_testuale VARCHAR(255) NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  gps_source ENUM('artigiano', 'foto_exif', 'matched', 'manual_admin') NOT NULL DEFAULT 'artigiano',
  gps_check_status ENUM('pending', 'ok', 'mismatch', 'no_exif') NOT NULL DEFAULT 'pending',
  cover_image_id INT NULL,
  stato_pubblicazione ENUM('draft', 'published', 'hidden') NOT NULL DEFAULT 'published',
  rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0,
  reviews_count INT NOT NULL DEFAULT 0,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lavori_slug (slug),
  KEY idx_lavori_geo (citta, quartiere, categoria_id, tipo_intervento_id),
  KEY idx_lavori_map (lat, lng),
  CONSTRAINT fk_lavori_artigiano
    FOREIGN KEY (artigiano_id) REFERENCES artigiani(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_lavori_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorie(id),
  CONSTRAINT fk_lavori_tipo
    FOREIGN KEY (tipo_intervento_id) REFERENCES tipi_intervento(id)
);

CREATE TABLE lavoro_immagini (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lavoro_id INT NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  alt_text VARCHAR(255) NULL,
  caption VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_cover TINYINT(1) NOT NULL DEFAULT 0,
  exif_present TINYINT(1) NOT NULL DEFAULT 0,
  exif_lat DECIMAL(10, 7) NULL,
  exif_lng DECIMAL(10, 7) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_immagini_lavoro
    FOREIGN KEY (lavoro_id) REFERENCES lavori(id)
    ON DELETE CASCADE
);

CREATE TABLE recensioni (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lavoro_id INT NOT NULL,
  artigiano_id INT NOT NULL,
  cliente_nome VARCHAR(140) NOT NULL,
  voto TINYINT NOT NULL,
  testo TEXT NOT NULL,
  stato ENUM('pending', 'published', 'hidden') NOT NULL DEFAULT 'published',
  data_recensione DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recensioni_lavoro
    FOREIGN KEY (lavoro_id) REFERENCES lavori(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_recensioni_artigiano
    FOREIGN KEY (artigiano_id) REFERENCES artigiani(id)
    ON DELETE CASCADE
);

CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ruolo ENUM('superadmin', 'editor', 'reviewer') NOT NULL DEFAULT 'editor',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  prezzo_mensile DECIMAL(8, 2) NOT NULL DEFAULT 0,
  max_lavori INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artigiano_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artigiano_id INT NOT NULL,
  piano_id INT NOT NULL,
  stato ENUM('active', 'expired', 'cancelled', 'pending') NOT NULL DEFAULT 'active',
  source ENUM('self_checkout', 'website_bundle', 'admin') NOT NULL DEFAULT 'self_checkout',
  included_with_website TINYINT(1) NOT NULL DEFAULT 0,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_artigiano
    FOREIGN KEY (artigiano_id) REFERENCES artigiani(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan
    FOREIGN KEY (piano_id) REFERENCES subscription_plans(id)
);

CREATE TABLE website_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artigiano_id INT NOT NULL,
  importo DECIMAL(8, 2) NOT NULL,
  stato ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  include_piano_id INT NULL,
  include_scadenza DATETIME NULL,
  attivato_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_website_artigiano
    FOREIGN KEY (artigiano_id) REFERENCES artigiani(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_website_plan
    FOREIGN KEY (include_piano_id) REFERENCES subscription_plans(id)
);
