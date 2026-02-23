// Studio Zero SF Type Definitions

export interface Guest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = 'pending' | 'approved' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  guest_id?: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  status: BookingStatus;
  nightly_rate: number;
  subtotal: number;
  discount_amount: number;
  cleaning_fee: number;
  total_amount: number;
  amount_paid: number;
  stripe_checkout_id?: string;
  stripe_payment_intent?: string;
  coupon_id?: string;
  guest_notes?: string;
  admin_notes?: string;
  approval_token?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  guest?: Guest;
  coupon?: Coupon;
}

export interface BlockedDate {
  id: string;
  date: string;
  reason?: 'owner_block' | 'maintenance' | 'other';
  created_at: string;
}

export type PricingRuleType = 'base' | 'weekend' | 'weekday' | 'date_override' | 'seasonal';

export interface PricingRule {
  id: string;
  name: string;
  rule_type: PricingRuleType;
  priority: number;
  nightly_rate: number;
  start_date?: string;
  end_date?: string;
  days_of_week?: number[];
  is_active: boolean;
  created_at: string;
}

export interface DateOverride {
  id: string;
  date: string;
  nightly_rate: number;
  note?: string;
  created_at: string;
}

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_nights: number;
  max_uses?: number;
  current_uses: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export interface Photo {
  id: string;
  storage_path: string;
  url: string;
  caption?: string;
  alt_text?: string;
  display_order: number;
  is_hero: boolean;
  created_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  booking_id?: string;
  email_type: string;
  recipient: string;
  sent_at: string;
  resend_id?: string;
}

// Settings type helpers
export interface PropertySettings {
  cleaning_fee: number;
  base_nightly_rate: number;
  min_nights: number;
  max_guests: number;
  check_in_time: string;
  check_out_time: string;
  property_name: string;
  property_description: string;
  neighborhood_info: string;
  house_rules: string[];
  cancellation_policy: CancellationPolicy;
  contact_email: string;
  wifi_network: string;
  wifi_password: string;
}

export interface CancellationPolicy {
  full_refund_days: number;
  partial_refund_days: number;
  partial_refund_percent: number;
  processing_fee_percent: number;
}

// Pricing calculation types
export interface NightPrice {
  date: string;
  rate: number;
}

export interface PricingBreakdown {
  nights: NightPrice[];
  subtotal: number;
  cleaningFee: number;
  discount: number;
  total: number;
}

// Availability types
export interface DateAvailability {
  date: string;
  available: boolean;
  price?: number;
  reason?: 'booked' | 'blocked' | 'past';
}
