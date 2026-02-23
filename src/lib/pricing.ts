import { supabase } from './supabase';
import type { PricingRule, DateOverride, Coupon, NightPrice, PricingBreakdown } from '../types';
import { eachDayOfInterval, format, getDay, parseISO, isWithinInterval, isBefore, startOfDay } from 'date-fns';

interface PricingRulesData {
  pricingRules: PricingRule[];
  dateOverrides: DateOverride[];
  cleaningFee: number;
}

// Priority values for rule types
const RULE_PRIORITY: Record<PricingRule['rule_type'], number> = {
  base: 0,
  weekday: 10,
  weekend: 10,
  seasonal: 50,
  date_override: 100,
};

// Weekend is Friday (5) and Saturday (6) nights
// Note: WEEKEND_DAYS would be used if needed for custom weekend detection
// Currently weekend detection is handled via pricing rules with days_of_week

/**
 * Fetches all active pricing rules, date overrides, and settings
 */
export async function fetchPricingData(): Promise<PricingRulesData> {
  const [rulesResponse, overridesResponse, settingsResponse] = await Promise.all([
    supabase
      .from('pricing_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false }),
    supabase
      .from('date_overrides')
      .select('*'),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'cleaning_fee')
      .single(),
  ]);

  if (rulesResponse.error) throw rulesResponse.error;
  if (overridesResponse.error) throw overridesResponse.error;

  return {
    pricingRules: rulesResponse.data || [],
    dateOverrides: overridesResponse.data || [],
    cleaningFee: settingsResponse.data?.value ?? 50,
  };
}

/**
 * Gets the nightly rate for a specific date
 * Priority: date_override (100) > seasonal (50) > weekend/weekday (10) > base (0)
 */
export function getRateForDate(
  date: Date,
  pricingRules: PricingRule[],
  dateOverrides: DateOverride[]
): number {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = getDay(date);

  // Check for date override first (highest priority)
  const override = dateOverrides.find(o => o.date === dateStr);
  if (override) {
    return override.nightly_rate;
  }

  // Filter applicable rules and find highest priority
  const applicableRules = pricingRules.filter(rule => {
    // Check if rule is active
    if (!rule.is_active) return false;

    // Check date range for seasonal rules
    if (rule.start_date && rule.end_date) {
      const start = parseISO(rule.start_date);
      const end = parseISO(rule.end_date);
      if (!isWithinInterval(date, { start, end })) {
        return false;
      }
    }

    // Check day of week for weekend/weekday rules
    if (rule.days_of_week && rule.days_of_week.length > 0) {
      if (!rule.days_of_week.includes(dayOfWeek)) {
        return false;
      }
    }

    return true;
  });

  // Sort by priority (descending) and return highest
  applicableRules.sort((a, b) => (b.priority ?? RULE_PRIORITY[b.rule_type]) - (a.priority ?? RULE_PRIORITY[a.rule_type]));

  if (applicableRules.length > 0) {
    return applicableRules[0].nightly_rate;
  }

  // Fallback to base rate (should always exist)
  const baseRule = pricingRules.find(r => r.rule_type === 'base');
  return baseRule?.nightly_rate ?? 165;
}

/**
 * Validates a coupon code
 */
export async function validateCoupon(
  code: string,
  nights: number,
  _checkInDate: Date
): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !coupon) {
    return { valid: false, error: 'Invalid coupon code' };
  }

  // Check min nights
  if (nights < coupon.min_nights) {
    return { valid: false, error: `Coupon requires at least ${coupon.min_nights} nights` };
  }

  // Check usage limit
  if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
    return { valid: false, error: 'Coupon has reached its usage limit' };
  }

  // Check valid dates
  const today = startOfDay(new Date());
  if (coupon.valid_from && isBefore(today, parseISO(coupon.valid_from))) {
    return { valid: false, error: 'Coupon is not yet valid' };
  }
  if (coupon.valid_until && isBefore(parseISO(coupon.valid_until), today)) {
    return { valid: false, error: 'Coupon has expired' };
  }

  return { valid: true, coupon };
}

/**
 * Calculates the discount amount based on coupon
 */
export function calculateDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.discount_type === 'percentage') {
    return Math.round((subtotal * coupon.discount_value / 100) * 100) / 100;
  }
  return Math.min(coupon.discount_value, subtotal);
}

/**
 * Main pricing calculation function
 * Calculates total price for a stay including all applicable rules and discounts
 */
export async function calculatePrice(
  checkIn: Date,
  checkOut: Date,
  couponCode?: string
): Promise<PricingBreakdown & { coupon?: Coupon; couponError?: string }> {
  // Fetch pricing data
  const { pricingRules, dateOverrides, cleaningFee } = await fetchPricingData();

  // Calculate nightly rates (each night is the check-in date of that night)
  // For a stay from Jan 1-3, nights are Jan 1 and Jan 2
  const nights: NightPrice[] = [];
  const checkOutPrevDay = new Date(checkOut.getTime() - 86400000); // Day before checkout

  if (checkIn <= checkOutPrevDay) {
    const nightDates = eachDayOfInterval({ start: checkIn, end: checkOutPrevDay });

    for (const date of nightDates) {
      const rate = getRateForDate(date, pricingRules, dateOverrides);
      nights.push({
        date: format(date, 'yyyy-MM-dd'),
        rate,
      });
    }
  }

  const subtotal = nights.reduce((sum, night) => sum + night.rate, 0);

  // Validate coupon if provided
  let discount = 0;
  let coupon: Coupon | undefined;
  let couponError: string | undefined;

  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, nights.length, checkIn);
    if (couponResult.valid && couponResult.coupon) {
      coupon = couponResult.coupon;
      discount = calculateDiscount(coupon, subtotal);
    } else {
      couponError = couponResult.error;
    }
  }

  const total = subtotal + cleaningFee - discount;

  return {
    nights,
    subtotal,
    cleaningFee,
    discount,
    total: Math.max(0, total),
    coupon,
    couponError,
  };
}

/**
 * Quick price estimate without fetching from database
 * Uses provided pricing data (for real-time UI updates)
 */
export function calculatePriceSync(
  checkIn: Date,
  checkOut: Date,
  pricingRules: PricingRule[],
  dateOverrides: DateOverride[],
  cleaningFee: number,
  coupon?: Coupon
): PricingBreakdown {
  const nights: NightPrice[] = [];
  const checkOutPrevDay = new Date(checkOut.getTime() - 86400000);

  if (checkIn <= checkOutPrevDay) {
    const nightDates = eachDayOfInterval({ start: checkIn, end: checkOutPrevDay });

    for (const date of nightDates) {
      const rate = getRateForDate(date, pricingRules, dateOverrides);
      nights.push({
        date: format(date, 'yyyy-MM-dd'),
        rate,
      });
    }
  }

  const subtotal = nights.reduce((sum, night) => sum + night.rate, 0);
  let discount = 0;

  if (coupon && nights.length >= coupon.min_nights) {
    discount = calculateDiscount(coupon, subtotal);
  }

  const total = subtotal + cleaningFee - discount;

  return {
    nights,
    subtotal,
    cleaningFee,
    discount,
    total: Math.max(0, total),
  };
}
