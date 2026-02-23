-- Function to increment coupon usage
-- Called by the webhook when a booking is completed

CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET current_uses = current_uses + 1
  WHERE id = coupon_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
