-- =====================================================================
-- BASE DE DONNÉES COMPLÈTE - SYSTÈME DE GESTION PHARMACEUTIQUE
-- Optimisé pour le Burkina Faso avec recherche géolocalisée
-- =====================================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- =====================================================================
-- 1. GESTION DES UTILISATEURS ET AUTHENTIFICATION
-- =====================================================================

CREATE TABLE auth_role (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(64) UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE auth_user (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(254) UNIQUE,
  phone varchar(32) UNIQUE,
  password_hash varchar(255),
  role_id uuid REFERENCES auth_role(id) ON DELETE RESTRICT,
  full_name varchar(255) NOT NULL,
  avatar_url text,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  last_login_at timestamptz,
  failed_login_attempts int DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_user_email ON auth_user(email) WHERE email IS NOT NULL;
CREATE INDEX idx_user_phone ON auth_user(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_active ON auth_user(is_active) WHERE is_active = true;

-- Tokens de réinitialisation et vérification
CREATE TABLE auth_token (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL,
  token_type varchar(32) NOT NULL, -- password_reset, email_verify, api_access
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_token_user ON auth_token(user_id);
CREATE INDEX idx_token_expires ON auth_token(expires_at) WHERE used_at IS NULL;

-- Clés API pour intégrations
CREATE TABLE api_key (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(128) NOT NULL,
  key_hash varchar(255) NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES auth_user(id) ON DELETE CASCADE,
  pharmacy_id uuid REFERENCES pharmacy(id) ON DELETE CASCADE,
  scopes text[] DEFAULT ARRAY[]::text[],
  rate_limit_per_hour int DEFAULT 1000,
  expires_at timestamptz,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_apikey_owner ON api_key(owner_user_id);
CREATE INDEX idx_apikey_pharmacy ON api_key(pharmacy_id);

-- =====================================================================
-- 2. PHARMACIES ET LOCALISATIONS
-- =====================================================================

CREATE TABLE pharmacy (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id uuid REFERENCES auth_user(id) ON DELETE SET NULL,
  legal_name varchar(255) NOT NULL,
  display_name varchar(255) NOT NULL,
  license_number varchar(128) UNIQUE,
  tax_id varchar(128),
  phone varchar(32),
  email varchar(254),
  website varchar(512),
  logo_url text,
  description text,
  business_hours jsonb,
  status varchar(32) DEFAULT 'active', -- active, inactive, suspended, pending
  subscription_plan varchar(32) DEFAULT 'basic', -- basic, premium, enterprise
  subscription_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pharmacy_status ON pharmacy(status);
CREATE INDEX idx_pharmacy_owner ON pharmacy(owner_user_id);

-- Succursales/Points de vente
CREATE TABLE pharmacy_location (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id uuid NOT NULL REFERENCES pharmacy(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  slug varchar(255),
  address_line varchar(255) NOT NULL,
  address_line2 varchar(255),
  postal_code varchar(32),
  city varchar(128) NOT NULL,
  region varchar(128) NOT NULL,
  country varchar(64) DEFAULT 'Burkina Faso',
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  contact_phone varchar(32),
  contact_email varchar(254),
  whatsapp varchar(32),
  opening_hours jsonb, -- {"lundi":"08:00-18:00", "mardi":"08:00-20:00", ...}
  special_hours jsonb, -- Jours fériés, fermetures exceptionnelles
  services jsonb DEFAULT '[]'::jsonb, -- delivery, consultation, vaccination, etc.
  accepts_online_orders boolean DEFAULT false,
  accepts_prescriptions boolean DEFAULT true,
  delivery_radius_km numeric(5,2),
  delivery_fee_cents bigint,
  minimum_order_cents bigint,
  average_rating numeric(3,2) DEFAULT 0,
  total_reviews int DEFAULT 0,
  is_24h boolean DEFAULT false,
  is_active boolean DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pharmacy_id, slug)
);

CREATE INDEX idx_location_pharmacy ON pharmacy_location(pharmacy_id);
CREATE INDEX idx_location_city ON pharmacy_location(city);
CREATE INDEX idx_location_region ON pharmacy_location(region);
CREATE INDEX idx_location_active ON pharmacy_location(is_active) WHERE is_active = true;
CREATE INDEX idx_location_coordinates ON pharmacy_location(latitude, longitude);
CREATE INDEX idx_location_online ON pharmacy_location(accepts_online_orders) WHERE accepts_online_orders = true;

-- Employés de pharmacie
CREATE TABLE pharmacy_staff (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id uuid NOT NULL REFERENCES pharmacy(id) ON DELETE CASCADE,
  location_id uuid REFERENCES pharmacy_location(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  position varchar(128), -- Pharmacien, Assistant, Caissier, Livreur
  license_number varchar(128),
  hire_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pharmacy_id, user_id)
);

CREATE INDEX idx_staff_pharmacy ON pharmacy_staff(pharmacy_id);
CREATE INDEX idx_staff_user ON pharmacy_staff(user_id);

-- =====================================================================
-- 3. FOURNISSEURS ET FABRICANTS
-- =====================================================================

CREATE TABLE manufacturer (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  country varchar(64),
  website varchar(512),
  contact_name varchar(255),
  phone varchar(32),
  email varchar(254),
  address jsonb,
  certifications jsonb, -- ISO, WHO-GMP, etc.
  is_approved boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_manufacturer_name ON manufacturer(name);
CREATE INDEX idx_manufacturer_country ON manufacturer(country);

CREATE TABLE supplier (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  supplier_code varchar(64) UNIQUE,
  contact_name varchar(255),
  phone varchar(32),
  email varchar(254),
  website varchar(512),
  address jsonb,
  payment_terms varchar(128), -- Net 30, Net 60, etc.
  delivery_time_days int,
  minimum_order_cents bigint,
  rating numeric(3,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_supplier_name ON supplier(name);
CREATE INDEX idx_supplier_active ON supplier(is_active) WHERE is_active = true;

-- =====================================================================
-- 4. CATALOGUE PRODUITS ENRICHI
-- =====================================================================

-- Codes ATC (Classification Anatomique, Thérapeutique et Chimique)
CREATE TABLE atc_code (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code varchar(32) UNIQUE NOT NULL,
  level int NOT NULL, -- 1-5
  parent_code varchar(32),
  label_fr varchar(512),
  label_en varchar(512),
  description text
);

CREATE INDEX idx_atc_code ON atc_code(code);
CREATE INDEX idx_atc_level ON atc_code(level);

-- Catégories de produits hiérarchiques
CREATE TABLE product_category (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  slug varchar(255) UNIQUE,
  parent_id uuid REFERENCES product_category(id) ON DELETE SET NULL,
  icon varchar(128),
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_category_parent ON product_category(parent_id);
CREATE INDEX idx_category_slug ON product_category(slug);

-- Produits (Master data)
CREATE TABLE product (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku varchar(128) UNIQUE NOT NULL,
  name varchar(512) NOT NULL,
  generic_name varchar(512),
  brand varchar(255),
  manufacturer_id uuid REFERENCES manufacturer(id) ON DELETE SET NULL,
  atc_id uuid REFERENCES atc_code(id) ON DELETE SET NULL,
  category_id uuid REFERENCES product_category(id) ON DELETE SET NULL,
  form varchar(64), -- comprimé, gélule, sirop, injectable, crème, pommade
  strength varchar(128), -- 500mg, 10mg/ml
  package_size varchar(128), -- 30 comprimés, 100ml
  units varchar(64), -- boîte, flacon, tube, ampoule
  description text,
  composition text,
  indications text,
  contraindications text,
  side_effects text,
  dosage text,
  storage_conditions text,
  requires_prescription boolean DEFAULT false,
  is_otc boolean DEFAULT true, -- Over-the-counter
  is_generic boolean DEFAULT false,
  is_cold_chain boolean DEFAULT false, -- Nécessite chaîne de froid
  substance_class varchar(64), -- narcotic, psychotropic, antibiotic, etc.
  pregnancy_category varchar(8), -- A, B, C, D, X
  dci varchar(255), -- Dénomination Commune Internationale
  barcode_ean varchar(32),
  image_url text,
  thumbnail_url text,
  video_url text,
  active boolean DEFAULT true,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_sku ON product(sku);
CREATE INDEX idx_product_name ON product(name);
CREATE INDEX idx_product_generic ON product(generic_name) WHERE generic_name IS NOT NULL;
CREATE INDEX idx_product_brand ON product(brand) WHERE brand IS NOT NULL;
CREATE INDEX idx_product_manufacturer ON product(manufacturer_id);
CREATE INDEX idx_product_category ON product(category_id);
CREATE INDEX idx_product_atc ON product(atc_id);
CREATE INDEX idx_product_form ON product(form);
CREATE INDEX idx_product_prescription ON product(requires_prescription);
CREATE INDEX idx_product_active ON product(active) WHERE active = true;
CREATE INDEX idx_product_name_trgm ON product USING gin (name gin_trgm_ops);
CREATE INDEX idx_product_generic_trgm ON product USING gin (generic_name gin_trgm_ops);

-- Identifiants alternatifs
CREATE TABLE product_identifier (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  scheme varchar(64) NOT NULL, -- gtin, ean13, upc, national_code, cip
  value varchar(255) NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, scheme, value)
);

CREATE INDEX idx_product_ident_product ON product_identifier(product_id);
CREATE INDEX idx_product_ident_value ON product_identifier(value);

-- Équivalents thérapeutiques (génériques)
CREATE TABLE product_equivalent (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  equivalent_product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  equivalence_type varchar(32) DEFAULT 'generic', -- generic, similar, alternative
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, equivalent_product_id),
  CHECK (product_id != equivalent_product_id)
);

CREATE INDEX idx_equiv_product ON product_equivalent(product_id);
CREATE INDEX idx_equiv_equiv ON product_equivalent(equivalent_product_id);

-- Images produits
CREATE TABLE product_image (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumbnail_url text,
  alt_text varchar(255),
  sort_order int DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_image_product ON product_image(product_id);

-- Documents (notices, certificats)
CREATE TABLE product_document (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  document_type varchar(64), -- notice, amm, certificate, datasheet
  title varchar(255),
  file_url text NOT NULL,
  file_size_bytes bigint,
  language varchar(8) DEFAULT 'fr',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_doc_product ON product_document(product_id);

-- =====================================================================
-- 5. LOTS ET PÉREMPTION
-- =====================================================================

CREATE TABLE product_batch (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  batch_number varchar(128) NOT NULL,
  supplier_id uuid REFERENCES supplier(id) ON DELETE SET NULL,
  manufacture_date date,
  expiry_date date NOT NULL,
  serial_number varchar(128),
  quality_status varchar(32) DEFAULT 'approved', -- approved, quarantine, rejected
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, batch_number)
);

CREATE INDEX idx_batch_product ON product_batch(product_id);
CREATE INDEX idx_batch_expiry ON product_batch(expiry_date);
CREATE INDEX idx_batch_expiring ON product_batch(expiry_date) 
  WHERE expiry_date > CURRENT_DATE AND expiry_date <= (CURRENT_DATE + INTERVAL '6 months');

-- =====================================================================
-- 6. INVENTAIRE ET STOCKS
-- =====================================================================

CREATE TABLE pharmacy_inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id uuid NOT NULL REFERENCES pharmacy_location(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES product_batch(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  min_quantity integer DEFAULT 0,
  max_quantity integer,
  reorder_point integer DEFAULT 10,
  cost_price_cents bigint,
  price_cents bigint NOT NULL DEFAULT 0,
  promo_price_cents bigint,
  margin_percent numeric(5,2),
  currency varchar(8) DEFAULT 'XOF',
  shelf_location varchar(64), -- A1, B5, etc.
  available integer GENERATED ALWAYS AS (quantity - reserved) STORED,
  is_available boolean GENERATED ALWAYS AS (quantity - reserved > 0) STORED,
  last_restock_at timestamptz,
  last_sale_at timestamptz,
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, product_id, batch_id),
  CHECK (reserved <= quantity)
);

CREATE INDEX idx_inv_location ON pharmacy_inventory(location_id);
CREATE INDEX idx_inv_product ON pharmacy_inventory(product_id);
CREATE INDEX idx_inv_batch ON pharmacy_inventory(batch_id);
CREATE INDEX idx_inv_available ON pharmacy_inventory(is_available) WHERE is_available = true;
CREATE INDEX idx_inv_low_stock ON pharmacy_inventory(location_id, product_id) 
  WHERE quantity <= reorder_point;
CREATE INDEX idx_inv_location_product ON pharmacy_inventory(location_id, product_id);

-- Historique des prix
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id uuid NOT NULL REFERENCES pharmacy_inventory(id) ON DELETE CASCADE,
  price_cents bigint NOT NULL,
  cost_price_cents bigint,
  currency varchar(8) DEFAULT 'XOF',
  reason varchar(128), -- restock, promotion, market_adjustment
  valid_from timestamptz DEFAULT now(),
  valid_to timestamptz,
  created_by uuid REFERENCES auth_user(id)
);

CREATE INDEX idx_price_history_inv ON price_history(inventory_id);
CREATE INDEX idx_price_history_dates ON price_history(valid_from, valid_to);

-- Promotions et offres
CREATE TABLE offer (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id uuid REFERENCES pharmacy_location(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product(id) ON DELETE CASCADE,
  offer_type varchar(32) DEFAULT 'discount', -- discount, bogo, bundle, flash_sale
  title varchar(255),
  description text,
  promo_price_cents bigint,
  discount_percent numeric(5,2),
  min_quantity int DEFAULT 1,
  max_quantity_per_customer int,
  currency varchar(8) DEFAULT 'XOF',
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  usage_limit int,
  times_used int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CHECK (valid_from < valid_to)
);

CREATE INDEX idx_offer_location ON offer(location_id);
CREATE INDEX idx_offer_product ON offer(product_id);
CREATE INDEX idx_offer_dates ON offer(valid_from, valid_to);
CREATE INDEX idx_offer_active ON offer(is_active, valid_from, valid_to) 
  WHERE is_active = true;

-- =====================================================================
-- 7. MOUVEMENTS DE STOCK
-- =====================================================================

CREATE TABLE inventory_movement (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id uuid REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  location_id uuid NOT NULL REFERENCES pharmacy_location(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES product_batch(id) ON DELETE SET NULL,
  movement_type varchar(32) NOT NULL, -- in, out, adjustment, transfer, return, damage, expiry
  quantity_change integer NOT NULL, -- positif ou négatif
  quantity_before integer,
  quantity_after integer,
  reason varchar(128) NOT NULL,
  reference varchar(255), -- order_id, supplier_invoice, transfer_id
  cost_cents bigint,
  notes text,
  actor_user_id uuid REFERENCES auth_user(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_movement_inventory ON inventory_movement(inventory_id);
CREATE INDEX idx_movement_location ON inventory_movement(location_id);
CREATE INDEX idx_movement_product ON inventory_movement(product_id);
CREATE INDEX idx_movement_type ON inventory_movement(movement_type);
CREATE INDEX idx_movement_date ON inventory_movement(created_at);

-- Transferts entre succursales
CREATE TABLE inventory_transfer (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_location_id uuid NOT NULL REFERENCES pharmacy_location(id) ON DELETE RESTRICT,
  to_location_id uuid NOT NULL REFERENCES pharmacy_location(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES product_batch(id),
  quantity int NOT NULL CHECK (quantity > 0),
  status varchar(32) DEFAULT 'pending', -- pending, in_transit, received, cancelled
  requested_by uuid REFERENCES auth_user(id),
  approved_by uuid REFERENCES auth_user(id),
  received_by uuid REFERENCES auth_user(id),
  requested_at timestamptz DEFAULT now(),
  shipped_at timestamptz,
  received_at timestamptz,
  notes text,
  CHECK (from_location_id != to_location_id)
);

CREATE INDEX idx_transfer_from ON inventory_transfer(from_location_id);
CREATE INDEX idx_transfer_to ON inventory_transfer(to_location_id);
CREATE INDEX idx_transfer_status ON inventory_transfer(status);

-- =====================================================================
-- 8. CLIENTS ET ADRESSES
-- =====================================================================

CREATE TABLE customer (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE REFERENCES auth_user(id) ON DELETE SET NULL,
  first_name varchar(128),
  last_name varchar(128),
  phone varchar(32) NOT NULL,
  email varchar(254),
  date_of_birth date,
  gender varchar(16), -- M, F, Autre
  preferred_language varchar(8) DEFAULT 'fr',
  allergies text[],
  chronic_conditions text[],
  loyalty_points int DEFAULT 0,
  total_orders int DEFAULT 0,
  total_spent_cents bigint DEFAULT 0,
  average_order_cents bigint DEFAULT 0,
  last_order_at timestamptz,
  is_vip boolean DEFAULT false,
  marketing_consent boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customer_user ON customer(user_id);
CREATE INDEX idx_customer_phone ON customer(phone);
CREATE INDEX idx_customer_email ON customer(email) WHERE email IS NOT NULL;

CREATE TABLE customer_address (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  label varchar(128), -- Domicile, Bureau, etc.
  address_line varchar(255) NOT NULL,
  address_line2 varchar(255),
  city varchar(128) NOT NULL,
  postal_code varchar(32),
  region varchar(128),
  country varchar(64) DEFAULT 'Burkina Faso',
  latitude numeric(10,7),
  longitude numeric(10,7),
  delivery_instructions text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customer_addr_customer ON customer_address(customer_id);
CREATE INDEX idx_customer_addr_coords ON customer_address(latitude, longitude);

-- =====================================================================
-- 9. COMMANDES ET PANIERS
-- =====================================================================

CREATE TABLE cart (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES customer(id) ON DELETE CASCADE,
  session_id varchar(255),
  location_id uuid REFERENCES pharmacy_location(id) ON DELETE SET NULL,
  expires_at timestamptz DEFAULT (now() + INTERVAL '7 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cart_customer ON cart(customer_id);
CREATE INDEX idx_cart_session ON cart(session_id);

CREATE TABLE cart_item (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id uuid NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  price_cents bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cart_id, product_id)
);

CREATE INDEX idx_cart_item_cart ON cart_item(cart_id);

CREATE TABLE "order" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number varchar(64) UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES pharmacy_location(id) ON DELETE RESTRICT,
  delivery_address_id uuid REFERENCES customer_address(id) ON DELETE SET NULL,
  status varchar(32) DEFAULT 'pending', -- pending, confirmed, preparing, ready, in_delivery, delivered, cancelled, refunded
  payment_status varchar(32) DEFAULT 'unpaid', -- unpaid, paid, partially_paid, refunded
  payment_method varchar(32), -- cash, mobile_money, card, bank_transfer
  subtotal_cents bigint DEFAULT 0,
  discount_cents bigint DEFAULT 0,
  delivery_fee_cents bigint DEFAULT 0,
  tax_cents bigint DEFAULT 0,
  total_cents bigint DEFAULT 0,
  currency varchar(8) DEFAULT 'XOF',
  requires_prescription boolean DEFAULT false,
  prescription_verified boolean DEFAULT false,
  delivery_type varchar(32) DEFAULT 'pickup', -- pickup, delivery, express
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  customer_notes text,
  pharmacy_notes text,
  tracking_number varchar(128),
  assigned_to uuid REFERENCES pharmacy_staff(id), -- Préparateur/Livreur
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_order_number ON "order"(order_number);
CREATE INDEX idx_order_customer ON "order"(customer_id);
CREATE INDEX idx_order_location ON "order"(location_id);
CREATE INDEX idx_order_status ON "order"(status);
CREATE INDEX idx_order_payment ON "order"(payment_status);
CREATE INDEX idx_order_date ON "order"(created_at);

CREATE TABLE order_item (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  inventory_id uuid REFERENCES pharmacy_inventory(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES product_batch(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_cents bigint NOT NULL,
  discount_cents bigint DEFAULT 0,
  total_cents bigint NOT NULL,
  substituted_for uuid REFERENCES product(id), -- Produit de substitution
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_order_item_order ON order_item(order_id);
CREATE INDEX idx_order_item_product ON order_item(product_id);

-- Historique des statuts
CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL,
  notes text,
  changed_by uuid REFERENCES auth_user(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_order_status_hist_order ON order_status_history(order_id);

-- =====================================================================
-- 10. PRESCRIPTIONS (SÉCURISÉ)
-- =====================================================================

CREATE TABLE prescription (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_number varchar(128) UNIQUE,
  order_id uuid REFERENCES "order"(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  patient_identifier_hash varchar(255), -- Hash du matricule patient
  prescriber_name varchar(255),
  prescriber_license varchar(128),
  issue_date date NOT NULL,
  valid_until date,
  diagnosis_code varchar(64),
  file_url_encrypted text, -- URL vers fichier chiffré (object storage)
  file_hash varchar(255), -- Pour vérifier l'intégrité
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES pharmacy_staff(id),
  verified_at timestamptz,
  is_used boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_prescription_customer ON prescription(customer_id);
CREATE INDEX idx_prescription_order ON prescription(order_id);
CREATE INDEX idx_prescription_verified ON prescription(is_verified);

CREATE TABLE prescription_item (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id uuid NOT NULL REFERENCES prescription(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product(id) ON DELETE SET NULL,
  product_name varchar(512),
  dosage varchar(255),
  frequency varchar(255),
  duration varchar(128),
  quantity int,
  instructions text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_prescription_item_rx ON prescription_item(prescription_id);

-- =====================================================================
-- 11. PAIEMENTS
-- =====================================================================

CREATE TABLE payment (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE RESTRICT,
  payment_method varchar(32) NOT NULL, -- cash, orange_money, moov_money, coris_money, card
  amount_cents bigint NOT NULL,
  currency varchar(8) DEFAULT 'XOF',
  status varchar(32) DEFAULT 'pending', -- pending, completed, failed, refunded
  transaction_id varchar(255),
  provider_reference varchar(255),
  phone_number varchar(32), -- Pour mobile money
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payment_order ON payment(order_id);
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_transaction ON payment(transaction_id);

-- =====================================================================
-- 12. LIVRAISONS
-- =====================================================================

CREATE TABLE delivery (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES pharmacy_staff(id) ON DELETE SET NULL,
  pickup_location_id uuid REFERENCES pharmacy_location(id),
  delivery_address jsonb NOT NULL,
  delivery_latitude numeric(10,7),
  delivery_longitude numeric(10,7),
  status varchar(32) DEFAULT 'pending', -- pending, assigned, picked_up, in_transit, delivered, failed
  scheduled_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  estimated_distance_km numeric(6,2),
  actual_distance_km numeric(6,2),
  delivery_instructions text,
  delivery_proof_url text, -- Photo de livraison
  signature_url text,
  recipient_name varchar(255),
  recipient_phone varchar(32),
  failed_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_delivery_order ON delivery(order_id);
CREATE INDEX idx_delivery_driver ON delivery(driver_id);
CREATE INDEX idx_delivery_status ON delivery(status);

-- Traçage GPS du livreur en temps réel
CREATE TABLE delivery_tracking (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id uuid NOT NULL REFERENCES delivery(id) ON DELETE CASCADE,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  accuracy_meters numeric(6,2),
  speed_kmh numeric(5,2),
  battery_level int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_delivery_track_delivery ON delivery_tracking(delivery_id);
CREATE INDEX idx_delivery_track_time ON delivery_tracking(created_at);

-- =====================================================================
-- 13. AVIS ET ÉVALUATIONS
-- =====================================================================

CREATE TABLE review (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id uuid NOT NULL REFERENCES pharmacy_location(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  order_id uuid REFERENCES "order"(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  product_quality_rating smallint CHECK (product_quality_rating >= 1 AND product_quality_rating <= 5),
  service_rating smallint CHECK (service_rating >= 1 AND service_rating <= 5),
  delivery_rating smallint CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  title varchar(255),
  comment text,
  images jsonb, -- URLs des photos
  is_verified_purchase boolean DEFAULT false,
  is_published boolean DEFAULT true,
  helpful_count int DEFAULT 0,
  response text, -- Réponse de la pharmacie
  responded_at timestamptz,
  responded_by uuid REFERENCES pharmacy_staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id, customer_id)
);

CREATE INDEX idx_review_location ON review(location_id);
CREATE INDEX idx_review_customer ON review(customer_id);
CREATE INDEX idx_review_order ON review(order_id);
CREATE INDEX idx_review_rating ON review(rating);
CREATE INDEX idx_review_published ON review(is_published) WHERE is_published = true;

-- Votes sur les avis
CREATE TABLE review_vote (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id uuid NOT NULL REFERENCES review(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  is_helpful boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, customer_id)
);

CREATE INDEX idx_review_vote_review ON review_vote(review_id);

-- =====================================================================
-- 14. PROGRAMMES DE FIDÉLITÉ
-- =====================================================================

CREATE TABLE loyalty_program (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id uuid NOT NULL REFERENCES pharmacy(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  points_per_xof numeric(10,4) DEFAULT 0.01, -- 1 point par 100 XOF
  points_expiry_days int DEFAULT 365,
  min_points_redemption int DEFAULT 100,
  redemption_value_cents bigint, -- Valeur de X points en XOF
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_loyalty_pharmacy ON loyalty_program(pharmacy_id);

CREATE TABLE loyalty_transaction (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_program(id) ON DELETE CASCADE,
  order_id uuid REFERENCES "order"(id) ON DELETE SET NULL,
  transaction_type varchar(32) NOT NULL, -- earn, redeem, expire, adjust
  points_change int NOT NULL,
  points_balance int NOT NULL,
  description text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_loyalty_trans_customer ON loyalty_transaction(customer_id);
CREATE INDEX idx_loyalty_trans_program ON loyalty_transaction(program_id);

-- =====================================================================
-- 15. ALERTES ET NOTIFICATIONS
-- =====================================================================

CREATE TABLE alert (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id uuid REFERENCES pharmacy(id) ON DELETE CASCADE,
  location_id uuid REFERENCES pharmacy_location(id) ON DELETE CASCADE,
  alert_type varchar(64) NOT NULL, -- low_stock, expiring_soon, out_of_stock, price_change
  severity varchar(32) DEFAULT 'info', -- info, warning, critical
  title varchar(255) NOT NULL,
  message text,
  related_product_id uuid REFERENCES product(id) ON DELETE CASCADE,
  related_batch_id uuid REFERENCES product_batch(id) ON DELETE CASCADE,
  metadata jsonb,
  is_read boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth_user(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alert_pharmacy ON alert(pharmacy_id);
CREATE INDEX idx_alert_location ON alert(location_id);
CREATE INDEX idx_alert_type ON alert(alert_type);
CREATE INDEX idx_alert_unread ON alert(is_read) WHERE is_read = false;

CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  notification_type varchar(64) NOT NULL,
  channel varchar(32) NOT NULL, -- email, sms, push, in_app
  title varchar(255),
  message text NOT NULL,
  data jsonb,
  priority varchar(32) DEFAULT 'normal', -- low, normal, high, urgent
  status varchar(32) DEFAULT 'pending', -- pending, sent, delivered, failed, read
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notif_user ON notification(user_id);
CREATE INDEX idx_notif_status ON notification(status);
CREATE INDEX idx_notif_unread ON notification(status) WHERE read_at IS NULL;

-- =====================================================================
-- 16. CONNECTEURS ET SYNCHRONISATION
-- =====================================================================

CREATE TABLE connector_agent (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id uuid NOT NULL REFERENCES pharmacy(id) ON DELETE CASCADE,
  name varchar(128) NOT NULL,
  agent_type varchar(64) NOT NULL, -- docker, windows_service, api_client, plugin
  version varchar(64),
  config jsonb,
  sync_interval_minutes int DEFAULT 60,
  last_sync_at timestamptz,
  last_seen_at timestamptz,
  is_active boolean DEFAULT true,
  is_healthy boolean DEFAULT true,
  health_check_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_connector_pharmacy ON connector_agent(pharmacy_id);
CREATE INDEX idx_connector_active ON connector_agent(is_active) WHERE is_active = true;

CREATE TABLE connector_sync_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id uuid NOT NULL REFERENCES connector_agent(id) ON DELETE CASCADE,
  sync_type varchar(64) NOT NULL, -- full, incremental, inventory, products, orders
  status varchar(32) NOT NULL, -- success, failed, partial
  records_processed int DEFAULT 0,
  records_inserted int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_failed int DEFAULT 0,
  error_message text,
  details jsonb,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX idx_sync_history_connector ON connector_sync_history(connector_id);
CREATE INDEX idx_sync_history_date ON connector_sync_history(started_at);

-- File d'attente pour synchronisation
CREATE TABLE sync_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id uuid NOT NULL REFERENCES connector_agent(id) ON DELETE CASCADE,
  entity_type varchar(64) NOT NULL, -- product, inventory, order, customer
  entity_id uuid NOT NULL,
  operation varchar(32) NOT NULL, -- create, update, delete
  payload jsonb NOT NULL,
  priority int DEFAULT 5,
  status varchar(32) DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  error_message text,
  scheduled_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sync_queue_connector ON sync_queue(connector_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, scheduled_at);

-- =====================================================================
-- 17. WEBHOOKS
-- =====================================================================

CREATE TABLE webhook_endpoint (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id uuid NOT NULL REFERENCES pharmacy(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret varchar(255) NOT NULL, -- Pour signature HMAC
  events text[] NOT NULL, -- order.created, inventory.low, etc.
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_pharmacy ON webhook_endpoint(pharmacy_id);

CREATE TABLE webhook_event (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoint(id) ON DELETE CASCADE,
  event_type varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(32) DEFAULT 'pending', -- pending, sent, failed
  retry_count int DEFAULT 0,
  response_status int,
  response_body text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_event_endpoint ON webhook_event(endpoint_id);
CREATE INDEX idx_webhook_event_status ON webhook_event(status);

-- =====================================================================
-- 18. AUDIT ET LOGS
-- =====================================================================

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id uuid REFERENCES auth_user(id) ON DELETE SET NULL,
  pharmacy_id uuid REFERENCES pharmacy(id) ON DELETE SET NULL,
  location_id uuid REFERENCES pharmacy_location(id) ON DELETE SET NULL,
  action varchar(128) NOT NULL,
  resource_type varchar(64) NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  session_id varchar(255),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_pharmacy ON audit_log(pharmacy_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- =====================================================================
-- 19. STATISTIQUES ET RAPPORTS (VUES MATÉRIALISÉES)
-- =====================================================================

-- Vue: Produits les plus vendus
CREATE MATERIALIZED VIEW mv_top_products AS
SELECT
  p.id,
  p.name,
  p.brand,
  COUNT(DISTINCT oi.order_id) AS order_count,
  SUM(oi.quantity) AS total_quantity,
  SUM(oi.total_cents) AS total_revenue_cents,
  AVG(oi.unit_price_cents) AS avg_price_cents
FROM product p
JOIN order_item oi ON oi.product_id = p.id
JOIN "order" o ON o.id = oi.order_id
WHERE o.status IN ('delivered', 'completed')
  AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.id, p.name, p.brand;

CREATE UNIQUE INDEX idx_mv_top_products_id ON mv_top_products(id);

-- Vue: Performance des pharmacies
CREATE MATERIALIZED VIEW mv_pharmacy_stats AS
SELECT
  l.id AS location_id,
  l.name AS location_name,
  l.pharmacy_id,
  COUNT(DISTINCT o.id) AS total_orders,
  COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) AS completed_orders,
  SUM(CASE WHEN o.status = 'delivered' THEN o.total_cents ELSE 0 END) AS total_revenue_cents,
  AVG(CASE WHEN o.status = 'delivered' THEN o.total_cents END) AS avg_order_value_cents,
  COUNT(DISTINCT o.customer_id) AS unique_customers,
  AVG(r.rating) AS avg_rating,
  COUNT(r.id) AS total_reviews
FROM pharmacy_location l
LEFT JOIN "order" o ON o.location_id = l.id AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN review r ON r.location_id = l.id AND r.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY l.id, l.name, l.pharmacy_id;

CREATE UNIQUE INDEX idx_mv_pharmacy_stats_loc ON mv_pharmacy_stats(location_id);

-- Vue: Recherche de produits optimisée
CREATE MATERIALIZED VIEW mv_product_search AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name,
  p.generic_name,
  p.brand,
  p.form,
  p.strength,
  p.description,
  p.requires_prescription,
  m.name AS manufacturer_name,
  c.name AS category_name,
  setweight(to_tsvector('simple', unaccent(coalesce(p.name,''))), 'A') ||
  setweight(to_tsvector('simple', unaccent(coalesce(p.generic_name,''))), 'A') ||
  setweight(to_tsvector('simple', unaccent(coalesce(p.brand,''))), 'B') ||
  setweight(to_tsvector('simple', unaccent(coalesce(p.description,''))), 'C') ||
  setweight(to_tsvector('simple', unaccent(coalesce(m.name,''))), 'D') AS search_vector
FROM product p
LEFT JOIN manufacturer m ON m.id = p.manufacturer_id
LEFT JOIN product_category c ON c.id = p.category_id
WHERE p.active = true;

CREATE UNIQUE INDEX idx_mv_product_search_id ON mv_product_search(product_id);
CREATE INDEX idx_mv_product_search_vec ON mv_product_search USING gin(search_vector);
CREATE INDEX idx_mv_product_search_name_trgm ON mv_product_search USING gin(name gin_trgm_ops);

-- =====================================================================
-- 20. VUES POUR REQUÊTES COURANTES
-- =====================================================================

-- Vue complète de l'inventaire avec détails
CREATE VIEW vw_inventory_full AS
SELECT
  pi.id AS inventory_id,
  pi.quantity,
  pi.reserved,
  pi.available,
  pi.price_cents,
  pi.promo_price_cents,
  pi.currency,
  pi.min_quantity,
  pi.reorder_point,
  pi.last_updated_at,
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  p.generic_name,
  p.brand,
  p.form,
  p.strength,
  p.requires_prescription,
  p.image_url,
  pb.batch_number,
  pb.expiry_date,
  CASE 
    WHEN pb.expiry_date <= CURRENT_DATE THEN 'expired'
    WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '3 months' THEN 'expiring_soon'
    ELSE 'valid'
  END AS expiry_status,
  l.id AS location_id,
  l.name AS location_name,
  l.city,
  l.region,
  l.latitude,
  l.longitude,
  l.accepts_online_orders,
  ph.id AS pharmacy_id,
  ph.display_name AS pharmacy_name,
  ph.phone AS pharmacy_phone,
  m.name AS manufacturer_name,
  c.name AS category_name
FROM pharmacy_inventory pi
JOIN product p ON p.id = pi.product_id
JOIN pharmacy_location l ON l.id = pi.location_id
JOIN pharmacy ph ON ph.id = l.pharmacy_id
LEFT JOIN product_batch pb ON pb.id = pi.batch_id
LEFT JOIN manufacturer m ON m.id = p.manufacturer_id
LEFT JOIN product_category c ON c.id = p.category_id
WHERE p.active = true AND l.is_active = true;

-- Vue des commandes avec détails client et pharmacie
CREATE VIEW vw_orders_full AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total_cents,
  o.currency,
  o.created_at,
  o.delivered_at,
  c.id AS customer_id,
  c.first_name || ' ' || c.last_name AS customer_name,
  c.phone AS customer_phone,
  c.email AS customer_email,
  l.id AS location_id,
  l.name AS location_name,
  ph.id AS pharmacy_id,
  ph.display_name AS pharmacy_name,
  COUNT(oi.id) AS item_count,
  SUM(oi.quantity) AS total_items
FROM "order" o
JOIN customer c ON c.id = o.customer_id
JOIN pharmacy_location l ON l.id = o.location_id
JOIN pharmacy ph ON ph.id = l.pharmacy_id
LEFT JOIN order_item oi ON oi.order_id = o.id
GROUP BY o.id, o.order_number, o.status, o.payment_status, o.total_cents, 
         o.currency, o.created_at, o.delivered_at, c.id, c.first_name, 
         c.last_name, c.phone, c.email, l.id, l.name, ph.id, ph.display_name;

-- Vue des produits avec stock disponible
CREATE VIEW vw_products_available AS
SELECT DISTINCT ON (p.id, l.id)
  p.id AS product_id,
  p.sku,
  p.name,
  p.brand,
  p.generic_name,
  p.form,
  p.strength,
  p.image_url,
  p.requires_prescription,
  l.id AS location_id,
  l.name AS location_name,
  l.city,
  l.latitude,
  l.longitude,
  ph.id AS pharmacy_id,
  ph.display_name AS pharmacy_name,
  pi.quantity AS stock_quantity,
  pi.price_cents,
  pi.promo_price_cents,
  COALESCE(o.promo_price_cents, pi.price_cents) AS final_price_cents,
  CASE WHEN o.id IS NOT NULL THEN true ELSE false END AS has_offer
FROM product p
JOIN pharmacy_inventory pi ON pi.product_id = p.id AND pi.available > 0
JOIN pharmacy_location l ON l.id = pi.location_id AND l.is_active = true
JOIN pharmacy ph ON ph.id = l.pharmacy_id AND ph.status = 'active'
LEFT JOIN offer o ON o.product_id = p.id 
  AND o.location_id = l.id 
  AND o.is_active = true
  AND now() BETWEEN o.valid_from AND o.valid_to
WHERE p.active = true;

-- =====================================================================
-- 21. FONCTIONS UTILITAIRES
-- =====================================================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Fonction pour calculer la distance entre deux points
CREATE OR REPLACE FUNCTION fn_calculate_distance(
  lat1 numeric, lon1 numeric,
  lat2 numeric, lon2 numeric
) RETURNS numeric AS $
BEGIN
  RETURN earth_distance(
    ll_to_earth(lat1, lon1),
    ll_to_earth(lat2, lon2)
  ) / 1000; -- Retourne en km
END;
$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction de recherche géolocalisée de produits
CREATE OR REPLACE FUNCTION fn_search_products_nearby(
  search_term text,
  user_lat numeric,
  user_lon numeric,
  radius_km numeric DEFAULT 10,
  max_results int DEFAULT 50
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  brand text,
  form text,
  price_cents bigint,
  location_id uuid,
  location_name text,
  pharmacy_name text,
  distance_km numeric,
  in_stock boolean
) AS $
BEGIN
  RETURN QUERY
  WITH search_matches AS (
    SELECT 
      mv.product_id,
      ts_rank(mv.search_vector, plainto_tsquery('simple', unaccent(search_term))) AS rank
    FROM mv_product_search mv
    WHERE mv.search_vector @@ plainto_tsquery('simple', unaccent(search_term))
       OR mv.name ILIKE '%' || search_term || '%'
       OR mv.generic_name ILIKE '%' || search_term || '%'
    ORDER BY rank DESC
    LIMIT 200
  )
  SELECT
    sm.product_id,
    p.name::text,
    p.brand::text,
    p.form::text,
    pi.price_cents,
    l.id,
    l.name::text,
    ph.display_name::text,
    fn_calculate_distance(l.latitude, l.longitude, user_lat, user_lon) AS distance_km,
    (pi.quantity > 0) AS in_stock
  FROM search_matches sm
  JOIN product p ON p.id = sm.product_id
  JOIN pharmacy_inventory pi ON pi.product_id = p.id AND pi.available > 0
  JOIN pharmacy_location l ON l.id = pi.location_id 
    AND l.is_active = true
    AND l.accepts_online_orders = true
  JOIN pharmacy ph ON ph.id = l.pharmacy_id AND ph.status = 'active'
  WHERE fn_calculate_distance(l.latitude, l.longitude, user_lat, user_lon) <= radius_km
  ORDER BY distance_km ASC, pi.price_cents ASC
  LIMIT max_results;
END;
$ LANGUAGE plpgsql STABLE;

-- Fonction pour réserver du stock
CREATE OR REPLACE FUNCTION fn_reserve_inventory(
  p_inventory_id uuid,
  p_quantity int
) RETURNS boolean AS $
DECLARE
  v_available int;
BEGIN
  SELECT (quantity - reserved) INTO v_available
  FROM pharmacy_inventory
  WHERE id = p_inventory_id
  FOR UPDATE;
  
  IF v_available >= p_quantity THEN
    UPDATE pharmacy_inventory
    SET reserved = reserved + p_quantity,
        last_updated_at = now()
    WHERE id = p_inventory_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$ LANGUAGE plpgsql;

-- =====================================================================
-- 22. TRIGGERS
-- =====================================================================

-- Trigger pour updated_at sur toutes les tables pertinentes
CREATE TRIGGER trg_auth_user_updated 
  BEFORE UPDATE ON auth_user 
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_pharmacy_updated 
  BEFORE UPDATE ON pharmacy 
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_pharmacy_location_updated 
  BEFORE UPDATE ON pharmacy_location 
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_product_updated 
  BEFORE UPDATE ON product 
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_customer_updated 
  BEFORE UPDATE ON customer 
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_order_updated 
  BEFORE UPDATE ON "order" 
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- Trigger pour mettre à jour les statistiques de la pharmacie après un avis
CREATE OR REPLACE FUNCTION fn_update_location_rating()
RETURNS TRIGGER AS $
BEGIN
  UPDATE pharmacy_location
  SET 
    average_rating = (
      SELECT AVG(rating)::numeric(3,2)
      FROM review
      WHERE location_id = NEW.location_id AND is_published = true
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM review
      WHERE location_id = NEW.location_id AND is_published = true
    )
  WHERE id = NEW.location_id;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_update_stats
  AFTER INSERT OR UPDATE ON review
  FOR EACH ROW EXECUTE FUNCTION fn_update_location_rating();

-- Trigger pour créer un mouvement de stock lors d'une vente
CREATE OR REPLACE FUNCTION fn_create_sale_movement()
RETURNS TRIGGER AS $
BEGIN
  INSERT INTO inventory_movement (
    inventory_id, location_id, product_id, batch_id,
    movement_type, quantity_change, reason, reference
  )
  SELECT
    oi.inventory_id,
    o.location_id,
    oi.product_id,
    oi.batch_id,
    'out',
    -oi.quantity,
    'sale',
    o.order_number
  FROM order_item oi
  JOIN "order" o ON o.id = oi.order_id
  WHERE oi.order_id = NEW.id;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_create_movement
  AFTER INSERT ON "order"
  FOR EACH ROW 
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION fn_create_sale_movement();

-- =====================================================================
-- 23. DONNÉES INITIALES (SEED)
-- =====================================================================

-- Rôles
INSERT INTO auth_role (name, description, permissions) VALUES
('superadmin', 'Administrateur système', '["*"]'::jsonb),
('pharmacy_admin', 'Gestionnaire de pharmacie', '["pharmacy:*", "inventory:*", "orders:*"]'::jsonb),
('pharmacist', 'Pharmacien', '["inventory:read", "orders:*", "prescriptions:*"]'::jsonb),
('cashier', 'Caissier', '["orders:create", "orders:read", "payments:*"]'::jsonb),
('delivery', 'Livreur', '["deliveries:*", "orders:read"]'::jsonb),
('customer', 'Client', '["orders:own", "reviews:create"]'::jsonb);

-- Catégories de produits principales
INSERT INTO product_category (name, slug, sort_order) VALUES
('Médicaments sur ordonnance', 'medicaments-ordonnance', 1),
('Médicaments sans ordonnance', 'medicaments-sans-ordonnance', 2),
('Parapharmacie', 'parapharmacie', 3),
('Hygiène et beauté', 'hygiene-beaute', 4),
('Vitamines et suppléments', 'vitamines-supplements', 5),
('Matériel médical', 'materiel-medical', 6),
('Bébé et maman', 'bebe-maman', 7),
('Diététique et nutrition', 'dietetique-nutrition', 8);

-- Codes ATC principaux (exemples)
INSERT INTO atc_code (code, level, label_fr, label_en) VALUES
('A', 1, 'Système digestif et métabolisme', 'Alimentary tract and metabolism'),
('B', 1, 'Sang et organes hématopoïétiques', 'Blood and blood forming organs'),
('C', 1, 'Système cardiovasculaire', 'Cardiovascular system'),
('D', 1, 'Dermatologie', 'Dermatologicals'),
('J', 1, 'Anti-infectieux généraux à usage systémique', 'Antiinfectives for systemic use'),
('M', 1, 'Système musculo-squelettique', 'Musculo-skeletal system'),
('N', 1, 'Système nerveux', 'Nervous system'),
('R', 1, 'Système respiratoire', 'Respiratory system');

-- =====================================================================
-- 24. INDEXES POUR PERFORMANCE
-- =====================================================================

-- Indexes composites pour les requêtes fréquentes
CREATE INDEX idx_inventory_location_available ON pharmacy_inventory(location_id, is_available) 
  WHERE is_available = true;

CREATE INDEX idx_order_customer_status ON "order"(customer_id, status, created_at DESC);

CREATE INDEX idx_order_location_date ON "order"(location_id, created_at DESC);

CREATE INDEX idx_product_category_active ON product(category_id, active) 
  WHERE active = true;

-- Index partiel pour produits périmant bientôt
CREATE INDEX idx_batch_expiring_soon ON product_batch(expiry_date, product_id)
  WHERE expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '6 months');

-- Index GiST pour recherches géospatiales optimisées
CREATE INDEX idx_location_geo_gist ON pharmacy_location 
  USING gist(ll_to_earth(latitude, longitude))
  WHERE is_active = true AND accepts_online_orders = true;

-- =====================================================================
-- 25. POLITIQUES DE SÉCURITÉ ET CONTRAINTES
-- =====================================================================

-- Contraintes de cohérence des données
ALTER TABLE pharmacy_inventory ADD CONSTRAINT chk_inventory_reserved 
  CHECK (reserved <= quantity);

ALTER TABLE "order" ADD CONSTRAINT chk_order_amounts 
  CHECK (total_cents >= 0 AND subtotal_cents >= 0);

ALTER TABLE payment ADD CONSTRAINT chk_payment_amount 
  CHECK (amount_cents > 0);

ALTER TABLE review ADD CONSTRAINT chk_review_ratings
  CHECK (
    rating BETWEEN 1 AND 5 AND
    (product_quality_rating IS NULL OR product_quality_rating BETWEEN 1 AND 5) AND
    (service_rating IS NULL OR service_rating BETWEEN 1 AND 5) AND
    (delivery_rating IS NULL OR delivery_rating BETWEEN 1 AND 5)
  );

-- =====================================================================
-- 26. TÂCHES DE MAINTENANCE AUTOMATISÉES
-- =====================================================================

-- Fonction pour nettoyer les paniers expirés
CREATE OR REPLACE FUNCTION fn_cleanup_expired_carts()
RETURNS int AS $
DECLARE
  deleted_count int;
BEGIN
  WITH deleted AS (
    DELETE FROM cart
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Fonction pour expirer les points de fidélité
CREATE OR REPLACE FUNCTION fn_expire_loyalty_points()
RETURNS int AS $
DECLARE
  expired_count int;
BEGIN
  WITH expired_points AS (
    INSERT INTO loyalty_transaction (
      customer_id, program_id, transaction_type, 
      points_change, points_balance, description
    )
    SELECT 
      lt.customer_id,
      lt.program_id,
      'expire',
      -lt.points_change,
      c.loyalty_points - lt.points_change,
      'Points expirés automatiquement'
    FROM loyalty_transaction lt
    JOIN customer c ON c.id = lt.customer_id
    WHERE lt.transaction_type = 'earn'
      AND lt.expires_at <= now()
      AND lt.expires_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_transaction lt2
        WHERE lt2.customer_id = lt.customer_id
          AND lt2.transaction_type = 'expire'
          AND lt2.created_at > lt.created_at
      )
    RETURNING customer_id
  )
  SELECT COUNT(DISTINCT customer_id) INTO expired_count FROM expired_points;
  
  UPDATE customer c
  SET loyalty_points = (
    SELECT COALESCE(SUM(points_change), 0)
    FROM loyalty_transaction lt
    WHERE lt.customer_id = c.id
  );
  
  RETURN expired_count;
END;
$ LANGUAGE plpgsql;

-- Fonction pour créer des alertes de stock faible
CREATE OR REPLACE FUNCTION fn_create_low_stock_alerts()
RETURNS int AS $
DECLARE
  alert_count int;
BEGIN
  WITH low_stock AS (
    INSERT INTO alert (
      pharmacy_id, location_id, alert_type, severity,
      title, message, related_product_id
    )
    SELECT DISTINCT
      l.pharmacy_id,
      pi.location_id,
      'low_stock',
      CASE 
        WHEN pi.quantity = 0 THEN 'critical'
        WHEN pi.quantity <= pi.min_quantity THEN 'warning'
        ELSE 'info'
      END,
      CASE 
        WHEN pi.quantity = 0 THEN 'Stock épuisé'
        ELSE 'Stock faible'
      END,
      'Le produit ' || p.name || ' nécessite un réapprovisionnement',
      pi.product_id
    FROM pharmacy_inventory pi
    JOIN product p ON p.id = pi.product_id
    JOIN pharmacy_location l ON l.id = pi.location_id
    WHERE pi.quantity <= pi.reorder_point
      AND NOT EXISTS (
        SELECT 1 FROM alert a
        WHERE a.related_product_id = pi.product_id
          AND a.location_id = pi.location_id
          AND a.alert_type = 'low_stock'
          AND a.is_resolved = false
          AND a.created_at > now() - INTERVAL '24 hours'
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO alert_count FROM low_stock;
  
  RETURN alert_count;
END;
$ LANGUAGE plpgsql;

-- Fonction pour créer des alertes de péremption
CREATE OR REPLACE FUNCTION fn_create_expiry_alerts()
RETURNS int AS $
DECLARE
  alert_count int;
BEGIN
  WITH expiring_batches AS (
    INSERT INTO alert (
      pharmacy_id, location_id, alert_type, severity,
      title, message, related_product_id, related_batch_id,
      metadata
    )
    SELECT DISTINCT
      l.pharmacy_id,
      pi.location_id,
      'expiring_soon',
      CASE 
        WHEN pb.expiry_date <= CURRENT_DATE THEN 'critical'
        WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '1 month' THEN 'warning'
        ELSE 'info'
      END,
      CASE 
        WHEN pb.expiry_date <= CURRENT_DATE THEN 'Produit périmé'
        ELSE 'Produit périmant bientôt'
      END,
      'Le lot ' || pb.batch_number || ' du produit ' || p.name || 
      ' expire le ' || pb.expiry_date::text,
      pi.product_id,
      pb.id,
      jsonb_build_object(
        'batch_number', pb.batch_number,
        'expiry_date', pb.expiry_date,
        'quantity', pi.quantity
      )
    FROM product_batch pb
    JOIN pharmacy_inventory pi ON pi.batch_id = pb.id
    JOIN product p ON p.id = pb.product_id
    JOIN pharmacy_location l ON l.id = pi.location_id
    WHERE pb.expiry_date <= CURRENT_DATE + INTERVAL '3 months'
      AND pi.quantity > 0
      AND NOT EXISTS (
        SELECT 1 FROM alert a
        WHERE a.related_batch_id = pb.id
          AND a.alert_type = 'expiring_soon'
          AND a.is_resolved = false
          AND a.created_at > now() - INTERVAL '7 days'
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO alert_count FROM expiring_batches;
  
  RETURN alert_count;
END;
$ LANGUAGE plpgsql;

-- =====================================================================
-- 27. FONCTIONS D'ANALYSE ET RAPPORTS
-- =====================================================================

-- Fonction pour obtenir les statistiques de vente
CREATE OR REPLACE FUNCTION fn_get_sales_stats(
  p_location_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  total_orders bigint,
  completed_orders bigint,
  cancelled_orders bigint,
  total_revenue_cents bigint,
  average_order_value_cents numeric,
  total_items_sold bigint,
  unique_customers bigint
) AS $
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE status = 'delivered')::bigint,
    COUNT(*) FILTER (WHERE status = 'cancelled')::bigint,
    COALESCE(SUM(total_cents) FILTER (WHERE status = 'delivered'), 0)::bigint,
    COALESCE(AVG(total_cents) FILTER (WHERE status = 'delivered'), 0)::numeric,
    COALESCE(SUM(
      (SELECT SUM(quantity) FROM order_item WHERE order_id = o.id)
    ), 0)::bigint,
    COUNT(DISTINCT customer_id)::bigint
  FROM "order" o
  WHERE location_id = p_location_id
    AND created_at BETWEEN p_start_date AND p_end_date;
END;
$ LANGUAGE plpgsql STABLE;

-- Fonction pour obtenir le top des clients
CREATE OR REPLACE FUNCTION fn_get_top_customers(
  p_pharmacy_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  total_orders bigint,
  total_spent_cents bigint,
  avg_order_value_cents numeric,
  last_order_date timestamptz
) AS $
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    COALESCE(c.first_name || ' ' || c.last_name, c.phone)::text,
    COUNT(o.id)::bigint,
    SUM(o.total_cents)::bigint,
    AVG(o.total_cents)::numeric,
    MAX(o.created_at)
  FROM customer c
  JOIN "order" o ON o.customer_id = c.id
  JOIN pharmacy_location l ON l.id = o.location_id
  WHERE l.pharmacy_id = p_pharmacy_id
    AND o.status = 'delivered'
  GROUP BY c.id, c.first_name, c.last_name, c.phone
  ORDER BY SUM(o.total_cents) DESC
  LIMIT p_limit;
END;
$ LANGUAGE plpgsql STABLE;

-- Fonction pour calculer le taux de rotation des stocks
CREATE OR REPLACE FUNCTION fn_calculate_inventory_turnover(
  p_location_id uuid,
  p_period_days int DEFAULT 30
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  avg_stock numeric,
  total_sold bigint,
  turnover_rate numeric,
  days_of_stock numeric
) AS $
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT
      oi.product_id,
      SUM(oi.quantity) AS total_quantity
    FROM order_item oi
    JOIN "order" o ON o.id = oi.order_id
    WHERE o.location_id = p_location_id
      AND o.status = 'delivered'
      AND o.created_at >= now() - (p_period_days || ' days')::interval
    GROUP BY oi.product_id
  ),
  stock_data AS (
    SELECT
      pi.product_id,
      AVG(pi.quantity) AS avg_quantity
    FROM pharmacy_inventory pi
    WHERE pi.location_id = p_location_id
    GROUP BY pi.product_id
  )
  SELECT
    p.id,
    p.name::text,
    COALESCE(sd.avg_quantity, 0)::numeric,
    COALESCE(sa.total_quantity, 0)::bigint,
    CASE 
      WHEN COALESCE(sd.avg_quantity, 0) > 0 
      THEN (COALESCE(sa.total_quantity, 0)::numeric / sd.avg_quantity) * (365.0 / p_period_days)
      ELSE 0
    END::numeric AS turnover_rate,
    CASE 
      WHEN COALESCE(sa.total_quantity, 0) > 0 
      THEN (sd.avg_quantity * p_period_days / sa.total_quantity)
      ELSE NULL
    END::numeric AS days_of_stock
  FROM product p
  LEFT JOIN sales_data sa ON sa.product_id = p.id
  LEFT JOIN stock_data sd ON sd.product_id = p.id
  WHERE EXISTS (
    SELECT 1 FROM pharmacy_inventory pi 
    WHERE pi.product_id = p.id AND pi.location_id = p_location_id
  )
  ORDER BY turnover_rate DESC NULLS LAST;
END;
$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 28. EXEMPLES DE REQUÊTES UTILES
-- =====================================================================

-- Commentaires avec exemples d'utilisation

COMMENT ON FUNCTION fn_search_products_nearby IS 
'Recherche de produits avec géolocalisation
Exemple: SELECT * FROM fn_search_products_nearby(''paracetamol'', 12.3714, -1.5197, 5, 20);';

COMMENT ON FUNCTION fn_get_sales_stats IS 
'Statistiques de vente pour une période
Exemple: SELECT * FROM fn_get_sales_stats(
  ''550e8400-e29b-41d4-a716-446655440000''::uuid,
  ''2025-01-01''::timestamptz,
  ''2025-01-31''::timestamptz
);';

COMMENT ON FUNCTION fn_reserve_inventory IS 
'Réserver du stock pour une commande
Exemple: SELECT fn_reserve_inventory(inventory_id, 5);';

-- =====================================================================
-- 29. REQUÊTE DE RECHERCHE GÉOLOCALISÉE OPTIMISÉE
-- =====================================================================

-- Requête principale pour rechercher des médicaments à proximité
COMMENT ON MATERIALIZED VIEW mv_product_search IS 
'Vue matérialisée pour recherche full-text de produits
À rafraîchir régulièrement: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_search;';

-- Exemple de requête complète pour l''application mobile
CREATE OR REPLACE FUNCTION fn_mobile_product_search(
  search_term text,
  user_lat numeric,
  user_lon numeric,
  radius_km numeric DEFAULT 10,
  filters jsonb DEFAULT '{}'::jsonb,
  sort_by text DEFAULT 'distance',
  page int DEFAULT 1,
  page_size int DEFAULT 20
)
RETURNS TABLE (
  product_id uuid,
  sku text,
  product_name text,
  generic_name text,
  brand text,
  form text,
  strength text,
  image_url text,
  requires_prescription boolean,
  location_id uuid,
  location_name text,
  pharmacy_id uuid,
  pharmacy_name text,
  pharmacy_phone text,
  address text,
  city text,
  latitude numeric,
  longitude numeric,
  distance_km numeric,
  price_cents bigint,
  promo_price_cents bigint,
  final_price_cents bigint,
  has_offer boolean,
  stock_quantity int,
  avg_rating numeric,
  review_count int,
  is_open boolean,
  delivery_available boolean
) AS $
DECLARE
  offset_val int := (page - 1) * page_size;
BEGIN
  RETURN QUERY
  WITH search_results AS (
    SELECT DISTINCT
      p.id AS p_id,
      p.sku AS p_sku,
      p.name AS p_name,
      p.generic_name AS p_generic,
      p.brand AS p_brand,
      p.form AS p_form,
      p.strength AS p_strength,
      p.image_url AS p_image,
      p.requires_prescription AS p_rx,
      l.id AS l_id,
      l.name AS l_name,
      ph.id AS ph_id,
      ph.display_name AS ph_name,
      ph.phone AS ph_phone,
      l.address_line AS l_address,
      l.city AS l_city,
      l.latitude AS l_lat,
      l.longitude AS l_lon,
      fn_calculate_distance(l.latitude, l.longitude, user_lat, user_lon) AS dist,
      pi.price_cents AS p_price,
      pi.promo_price_cents AS p_promo,
      COALESCE(o.promo_price_cents, pi.price_cents) AS p_final,
      (o.id IS NOT NULL) AS has_promo,
      pi.quantity AS p_qty,
      l.average_rating AS l_rating,
      l.total_reviews AS l_reviews,
      -- Vérifier si ouvert maintenant (simplifié)
      true AS is_open_now,
      l.accepts_online_orders AS can_deliver
    FROM mv_product_search mv
    JOIN product p ON p.id = mv.product_id
    JOIN pharmacy_inventory pi ON pi.product_id = p.id AND pi.available > 0
    JOIN pharmacy_location l ON l.id = pi.location_id 
      AND l.is_active = true
      AND l.accepts_online_orders = true
    JOIN pharmacy ph ON ph.id = l.pharmacy_id AND ph.status = 'active'
    LEFT JOIN offer o ON o.product_id = p.id 
      AND o.location_id = l.id 
      AND o.is_active = true
      AND now() BETWEEN o.valid_from AND o.valid_to
    WHERE (
      search_term = '' 
      OR mv.search_vector @@ plainto_tsquery('simple', unaccent(search_term))
      OR mv.name ILIKE '%' || search_term || '%'
      OR mv.generic_name ILIKE '%' || search_term || '%'
    )
    AND fn_calculate_distance(l.latitude, l.longitude, user_lat, user_lon) <= radius_km
    -- Appliquer les filtres JSON si fournis
    AND (NOT (filters ? 'requires_prescription') 
         OR p.requires_prescription = (filters->>'requires_prescription')::boolean)
    AND (NOT (filters ? 'min_price') 
         OR pi.price_cents >= (filters->>'min_price')::bigint)
    AND (NOT (filters ? 'max_price') 
         OR pi.price_cents <= (filters->>'max_price')::bigint)
    AND (NOT (filters ? 'category_id') 
         OR p.category_id = (filters->>'category_id')::uuid)
  )
  SELECT
    p_id, p_sku, p_name, p_generic, p_brand, p_form, p_strength, p_image, p_rx,
    l_id, l_name, ph_id, ph_name, ph_phone, l_address, l_city, l_lat, l_lon,
    dist, p_price, p_promo, p_final, has_promo, p_qty, l_rating, l_reviews,
    is_open_now, can_deliver
  FROM search_results
  ORDER BY
    CASE 
      WHEN sort_by = 'distance' THEN dist
      WHEN sort_by = 'price' THEN p_final::numeric / 100000
      WHEN sort_by = 'rating' THEN -l_rating
      ELSE dist
    END,
    p_final
  LIMIT page_size
  OFFSET offset_val;
END;
$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 30. JOBS DE MAINTENANCE (À PLANIFIER AVEC pg_cron OU EXTÉRIEUR)
-- =====================================================================

COMMENT ON FUNCTION fn_cleanup_expired_carts IS 
'À exécuter quotidiennement pour nettoyer les paniers expirés';

COMMENT ON FUNCTION fn_expire_loyalty_points IS 
'À exécuter quotidiennement pour expirer les points de fidélité';

COMMENT ON FUNCTION fn_create_low_stock_alerts IS 
'À exécuter toutes les heures pour créer des alertes de stock faible';

COMMENT ON FUNCTION fn_create_expiry_alerts IS 
'À exécuter quotidiennement pour alerter sur les produits périmant';

-- =====================================================================
-- 31. VUES POUR TABLEAUX DE BORD
-- =====================================================================

-- Dashboard pharmacie: Vue d'ensemble
CREATE VIEW vw_pharmacy_dashboard AS
SELECT
  ph.id AS pharmacy_id,
  ph.display_name,
  COUNT(DISTINCT l.id) AS total_locations,
  COUNT(DISTINCT ps.id) FILTER (WHERE ps.is_active) AS active_staff,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS orders_last_30d,
  SUM(o.total_cents) FILTER (
    WHERE o.status = 'delivered' 
    AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS revenue_last_30d_cents,
  COUNT(DISTINCT o.customer_id) FILTER (
    WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS customers_last_30d,
  (
    SELECT COUNT(*) 
    FROM alert a 
    WHERE a.pharmacy_id = ph.id 
      AND a.is_resolved = false
  ) AS pending_alerts,
  (
    SELECT COUNT(*)
    FROM pharmacy_inventory pi
    JOIN pharmacy_location l2 ON l2.id = pi.location_id
    WHERE l2.pharmacy_id = ph.id
      AND pi.quantity <= pi.reorder_point
  ) AS low_stock_count
FROM pharmacy ph
LEFT JOIN pharmacy_location l ON l.pharmacy_id = ph.id
LEFT JOIN pharmacy_staff ps ON ps.pharmacy_id = ph.id
LEFT JOIN "order" o ON o.location_id = l.id
GROUP BY ph.id, ph.display_name;

-- Dashboard produit: Informations complètes
CREATE VIEW vw_product_dashboard AS
SELECT
  p.id AS product_id,
  p.name,
  p.brand,
  p.generic_name,
  p.form,
  p.category_id,
  c.name AS category_name,
  COUNT(DISTINCT pi.location_id) AS available_at_locations,
  SUM(pi.quantity) AS total_stock,
  MIN(pi.price_cents) AS min_price_cents,
  MAX(pi.price_cents) AS max_price_cents,
  AVG(pi.price_cents) AS avg_price_cents,
  COUNT(DISTINCT oi.order_id) FILTER (
    WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS orders_last_30d,
  SUM(oi.quantity) FILTER (
    WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS units_sold_last_30d,
  (
    SELECT MIN(expiry_date)
    FROM product_batch pb
    WHERE pb.product_id = p.id
      AND pb.expiry_date >= CURRENT_DATE
  ) AS next_expiry_date
FROM product p
LEFT JOIN product_category c ON c.id = p.category_id
LEFT JOIN pharmacy_inventory pi ON pi.product_id = p.id
LEFT JOIN order_item oi ON oi.product_id = p.id
LEFT JOIN "order" o ON o.id = oi.order_id
WHERE p.active = true
GROUP BY p.id, p.name, p.brand, p.generic_name, p.form, p.category_id, c.name;

-- =====================================================================
-- 32. PERMISSIONS ET SÉCURITÉ (RLS - ROW LEVEL SECURITY)
-- =====================================================================

-- Activer RLS sur les tables sensibles
ALTER TABLE prescription ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;

-- Exemple de politique RLS (à adapter selon vos besoins)
CREATE POLICY customer_own_data ON customer
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY order_own_data ON "order"
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customer 
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  );

-- =====================================================================
-- FIN DU SCRIPT
-- =====================================================================

-- Rafraîchir les vues matérialisées initiales
REFRESH MATERIALIZED VIEW mv_product_search;
REFRESH MATERIALIZED VIEW mv_top_products;
REFRESH MATERIALIZED VIEW mv_pharmacy_stats;

-- Message de succès
DO $
BEGIN
  RAISE NOTICE '✅ Base de données pharmaceutique créée avec succès!';
  RAISE NOTICE '📊 Tables: %, Vues: %, Fonctions: %',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public'),
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public');
END $;