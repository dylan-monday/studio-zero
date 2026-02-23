-- Studio Zero SF Database Schema
-- Initial migration: Create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- GUESTS TABLE
-- ============================================
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_guests_email ON guests(email);

-- ============================================
-- COUPONS TABLE (referenced by bookings)
-- ============================================
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  min_nights INT DEFAULT 1 CHECK (min_nights >= 1),
  max_uses INT,
  current_uses INT DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for coupon code lookups
CREATE INDEX idx_coupons_code ON coupons(code);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INT GENERATED ALWAYS AS (check_out - check_in) STORED,
  guests_count INT DEFAULT 1 CHECK (guests_count >= 1 AND guests_count <= 4),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'confirmed', 'cancelled', 'completed')),
  nightly_rate DECIMAL(10,2) NOT NULL CHECK (nightly_rate >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  cleaning_fee DECIMAL(10,2) DEFAULT 0 CHECK (cleaning_fee >= 0),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid DECIMAL(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  stripe_checkout_id TEXT,
  stripe_payment_intent TEXT,
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  guest_notes TEXT,
  admin_notes TEXT,
  approval_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure check_out is after check_in
  CONSTRAINT valid_dates CHECK (check_out > check_in)
);

-- Indexes for common queries
CREATE INDEX idx_bookings_guest_id ON bookings(guest_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_check_in ON bookings(check_in);
CREATE INDEX idx_bookings_check_out ON bookings(check_out);
CREATE INDEX idx_bookings_approval_token ON bookings(approval_token);
CREATE INDEX idx_bookings_dates ON bookings(check_in, check_out);

-- ============================================
-- BLOCKED_DATES TABLE
-- ============================================
CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  reason TEXT CHECK (reason IN ('owner_block', 'maintenance', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date lookups
CREATE INDEX idx_blocked_dates_date ON blocked_dates(date);

-- ============================================
-- PRICING_RULES TABLE
-- ============================================
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('base', 'weekend', 'weekday', 'date_override', 'seasonal')),
  priority INT DEFAULT 0,
  nightly_rate DECIMAL(10,2) NOT NULL CHECK (nightly_rate >= 0),
  start_date DATE,
  end_date DATE,
  days_of_week INT[], -- 0=Sun, 1=Mon... 6=Sat
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure end_date is after start_date when both are set
  CONSTRAINT valid_date_range CHECK (
    (start_date IS NULL AND end_date IS NULL) OR
    (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
  )
);

-- Index for active rules
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type);

-- ============================================
-- DATE_OVERRIDES TABLE
-- Simple table for single-date price overrides
-- ============================================
CREATE TABLE date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  nightly_rate DECIMAL(10,2) NOT NULL CHECK (nightly_rate >= 0),
  note TEXT, -- e.g., "Fleet Week", "Dreamforce"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date lookups
CREATE INDEX idx_date_overrides_date ON date_overrides(date);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  alt_text TEXT,
  display_order INT DEFAULT 0,
  is_hero BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX idx_photos_order ON photos(display_order);

-- ============================================
-- SETTINGS TABLE
-- Key-value store for property configuration
-- ============================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EMAIL_LOG TABLE
-- ============================================
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resend_id TEXT
);

-- Index for booking lookups
CREATE INDEX idx_email_log_booking ON email_log(booking_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to guests table
CREATE TRIGGER update_guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to bookings table
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to settings table
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Default Settings
-- ============================================
INSERT INTO settings (key, value) VALUES
  ('cleaning_fee', '50'::jsonb),
  ('base_nightly_rate', '165'::jsonb),
  ('min_nights', '2'::jsonb),
  ('max_guests', '2'::jsonb),
  ('check_in_time', '"3:00 PM"'::jsonb),
  ('check_out_time', '"11:00 AM"'::jsonb),
  ('property_name', '"Studio Zero SF"'::jsonb),
  ('property_description', '"A beautifully designed studio apartment in the heart of San Francisco. Perfect for couples or solo travelers looking for a comfortable, stylish home base while exploring the city."'::jsonb),
  ('neighborhood_info', '"Located in a vibrant neighborhood with easy access to public transit, restaurants, and local attractions. Walk to nearby parks, cafes, and shops within minutes."'::jsonb),
  ('house_rules', '["No smoking inside or on balcony", "No parties or events", "No pets (allergies)", "Quiet hours: 10 PM - 8 AM", "Maximum 2 guests", "Shoes off inside", "No candles or incense"]'::jsonb),
  ('cancellation_policy', '{"full_refund_days": 30, "partial_refund_days": 14, "partial_refund_percent": 50, "processing_fee_percent": 3}'::jsonb),
  ('contact_email', '"hello@studiozerosf.com"'::jsonb),
  ('wifi_network', '""'::jsonb),
  ('wifi_password', '""'::jsonb);

-- Seed default base pricing rule
INSERT INTO pricing_rules (name, rule_type, priority, nightly_rate, is_active)
VALUES ('Base Rate', 'base', 0, 165.00, true);

-- Seed weekend pricing rule (Fri & Sat nights)
INSERT INTO pricing_rules (name, rule_type, priority, nightly_rate, days_of_week, is_active)
VALUES ('Weekend Rate', 'weekend', 10, 185.00, ARRAY[5, 6], true);
