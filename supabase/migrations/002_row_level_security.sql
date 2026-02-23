-- Studio Zero SF Row Level Security Policies
-- Implements access control for all tables

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GUESTS TABLE POLICIES
-- ============================================

-- Guests can read their own profile
CREATE POLICY "Guests can view own profile"
  ON guests FOR SELECT
  USING (auth.uid()::text = id::text OR is_admin());

-- Guests can update their own profile
CREATE POLICY "Guests can update own profile"
  ON guests FOR UPDATE
  USING (auth.uid()::text = id::text OR is_admin());

-- Guests can insert their own profile (on signup)
CREATE POLICY "Guests can create own profile"
  ON guests FOR INSERT
  WITH CHECK (auth.uid()::text = id::text OR is_admin());

-- Admin can do anything with guests
CREATE POLICY "Admin full access to guests"
  ON guests FOR ALL
  USING (is_admin());

-- ============================================
-- BOOKINGS TABLE POLICIES
-- ============================================

-- Guests can view their own bookings
CREATE POLICY "Guests can view own bookings"
  ON bookings FOR SELECT
  USING (
    guest_id::text = auth.uid()::text
    OR is_admin()
  );

-- Guests can create bookings (linked to their account)
CREATE POLICY "Guests can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    guest_id::text = auth.uid()::text
    OR is_admin()
  );

-- Guests can update their own pending bookings (for modifications)
CREATE POLICY "Guests can update own pending bookings"
  ON bookings FOR UPDATE
  USING (
    (guest_id::text = auth.uid()::text AND status IN ('pending', 'approved'))
    OR is_admin()
  );

-- Admin can do anything with bookings
CREATE POLICY "Admin full access to bookings"
  ON bookings FOR ALL
  USING (is_admin());

-- ============================================
-- BLOCKED_DATES TABLE POLICIES
-- ============================================

-- Anyone can read blocked dates (for availability calendar)
CREATE POLICY "Public read blocked dates"
  ON blocked_dates FOR SELECT
  USING (true);

-- Only admin can modify blocked dates
CREATE POLICY "Admin manage blocked dates"
  ON blocked_dates FOR ALL
  USING (is_admin());

-- ============================================
-- PRICING_RULES TABLE POLICIES
-- ============================================

-- Anyone can read active pricing rules
CREATE POLICY "Public read pricing rules"
  ON pricing_rules FOR SELECT
  USING (true);

-- Only admin can modify pricing rules
CREATE POLICY "Admin manage pricing rules"
  ON pricing_rules FOR ALL
  USING (is_admin());

-- ============================================
-- DATE_OVERRIDES TABLE POLICIES
-- ============================================

-- Anyone can read date overrides (for pricing display)
CREATE POLICY "Public read date overrides"
  ON date_overrides FOR SELECT
  USING (true);

-- Only admin can modify date overrides
CREATE POLICY "Admin manage date overrides"
  ON date_overrides FOR ALL
  USING (is_admin());

-- ============================================
-- COUPONS TABLE POLICIES
-- ============================================

-- Anyone can read active coupons (for validation)
-- Note: Only expose necessary fields via API
CREATE POLICY "Public read active coupons"
  ON coupons FOR SELECT
  USING (is_active = true);

-- Admin can see all coupons
CREATE POLICY "Admin view all coupons"
  ON coupons FOR SELECT
  USING (is_admin());

-- Only admin can manage coupons
CREATE POLICY "Admin manage coupons"
  ON coupons FOR ALL
  USING (is_admin());

-- ============================================
-- PHOTOS TABLE POLICIES
-- ============================================

-- Anyone can view photos (public gallery)
CREATE POLICY "Public read photos"
  ON photos FOR SELECT
  USING (true);

-- Only admin can manage photos
CREATE POLICY "Admin manage photos"
  ON photos FOR ALL
  USING (is_admin());

-- ============================================
-- SETTINGS TABLE POLICIES
-- ============================================

-- Anyone can read non-sensitive settings
-- We'll use a safe list of public keys
CREATE POLICY "Public read public settings"
  ON settings FOR SELECT
  USING (
    key IN (
      'property_name',
      'property_description',
      'neighborhood_info',
      'house_rules',
      'check_in_time',
      'check_out_time',
      'max_guests',
      'min_nights',
      'cleaning_fee',
      'cancellation_policy'
    )
    OR is_admin()
  );

-- Only admin can modify settings
CREATE POLICY "Admin manage settings"
  ON settings FOR ALL
  USING (is_admin());

-- ============================================
-- EMAIL_LOG TABLE POLICIES
-- ============================================

-- Guests can view email logs for their bookings
CREATE POLICY "Guests view own email logs"
  ON email_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = email_log.booking_id
      AND bookings.guest_id::text = auth.uid()::text
    )
    OR is_admin()
  );

-- Only admin (via service role) can insert email logs
CREATE POLICY "Admin manage email logs"
  ON email_log FOR ALL
  USING (is_admin());

-- ============================================
-- STORAGE POLICIES (for photos bucket)
-- Run these via Supabase Dashboard > Storage
-- ============================================
--
-- Policy: Public read access to photos bucket
-- INSERT: Only authenticated admin
-- SELECT: Public (anyone)
-- UPDATE: Only authenticated admin
-- DELETE: Only authenticated admin
