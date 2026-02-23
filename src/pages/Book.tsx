import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, differenceInDays } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { AvailabilityCalendar } from '../components/booking/AvailabilityCalendar';
import { fetchPricingData, calculatePriceSync, validateCoupon } from '../lib/pricing';
import { isDateRangeAvailable, getMinNights, getMaxGuests } from '../lib/availability';
import { supabase } from '../lib/supabase';
import type { PricingBreakdown, Coupon, PricingRule, DateOverride, Guest } from '../types';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface GuestFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  notes: string;
}

type BookingStep = 'dates' | 'details' | 'review';

export function Book() {
  const [searchParams] = useSearchParams();
  const wasCancelled = searchParams.get('cancelled') === 'true';

  // Step state
  const [step, setStep] = useState<BookingStep>('dates');

  // Date selection
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [selectingCheckOut, setSelectingCheckOut] = useState(false);

  // Guest count
  const [guestCount, setGuestCount] = useState(1);
  const [maxGuests, setMaxGuests] = useState(2);

  // Pricing
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [cleaningFee, setCleaningFee] = useState(50);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Guest details
  const [guestForm, setGuestForm] = useState<GuestFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    notes: '',
  });
  const [existingGuest, setExistingGuest] = useState<Guest | null>(null);

  // Settings
  const [minNights, setMinNights] = useState(2);

  // Validation
  const [dateError, setDateError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof GuestFormData, string>>>({});

  // Checkout
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Load settings and pricing data on mount
  useEffect(() => {
    async function loadData() {
      const [minN, maxG, pricingData] = await Promise.all([
        getMinNights(),
        getMaxGuests(),
        fetchPricingData(),
      ]);
      setMinNights(minN);
      setMaxGuests(maxG);
      setPricingRules(pricingData.pricingRules);
      setDateOverrides(pricingData.dateOverrides);
      setCleaningFee(pricingData.cleaningFee);
    }
    loadData();
  }, []);

  // Calculate nights
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    return differenceInDays(checkOut, checkIn);
  }, [checkIn, checkOut]);

  // Real-time pricing calculation
  useEffect(() => {
    if (!checkIn || !checkOut || nights < 1) {
      setPricing(null);
      return;
    }

    // Use sync calculation for immediate feedback
    const syncPricing = calculatePriceSync(
      checkIn,
      checkOut,
      pricingRules,
      dateOverrides,
      cleaningFee,
      coupon || undefined
    );
    setPricing(syncPricing);
  }, [checkIn, checkOut, nights, pricingRules, dateOverrides, cleaningFee, coupon]);

  // Handle date selection
  const handleDateSelect = useCallback(async (date: Date) => {
    setDateError(null);

    if (!selectingCheckOut || !checkIn) {
      // Selecting check-in
      setCheckIn(date);
      setCheckOut(undefined);
      setSelectingCheckOut(true);
    } else {
      // Selecting check-out
      if (date <= checkIn) {
        // If clicked date is before or same as check-in, restart
        setCheckIn(date);
        setCheckOut(undefined);
        return;
      }

      const nightCount = differenceInDays(date, checkIn);
      if (nightCount < minNights) {
        setDateError(`Minimum stay is ${minNights} nights`);
        return;
      }

      // Check availability
      const availability = await isDateRangeAvailable(checkIn, date);
      if (!availability.available) {
        setDateError('Some dates in this range are unavailable');
        return;
      }

      setCheckOut(date);
      setSelectingCheckOut(false);
    }
  }, [selectingCheckOut, checkIn, minNights]);

  // Apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !checkIn || !checkOut) return;

    setCouponLoading(true);
    setCouponError(null);

    const result = await validateCoupon(couponCode, nights, checkIn);

    if (result.valid && result.coupon) {
      setCoupon(result.coupon);
      setCouponError(null);
    } else {
      setCoupon(null);
      setCouponError(result.error || 'Invalid coupon');
    }

    setCouponLoading(false);
  };

  // Remove coupon
  const handleRemoveCoupon = () => {
    setCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  // Check for existing guest by email
  const handleEmailBlur = async () => {
    if (!guestForm.email) return;

    const { data } = await supabase
      .from('guests')
      .select('*')
      .eq('email', guestForm.email.toLowerCase().trim())
      .single();

    if (data) {
      setExistingGuest(data);
      setGuestForm({
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone || '',
        notes: guestForm.notes,
      });
    } else {
      setExistingGuest(null);
    }
  };

  // Validate guest form
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof GuestFormData, string>> = {};

    if (!guestForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!guestForm.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!guestForm.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (!guestForm.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle step navigation
  const handleContinueToDetails = () => {
    if (!checkIn || !checkOut) {
      setDateError('Please select check-in and check-out dates');
      return;
    }
    setStep('details');
  };

  const handleContinueToReview = () => {
    if (!validateForm()) return;
    setStep('review');
  };

  const handleProceedToPayment = async () => {
    if (!checkIn || !checkOut || !pricing) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkIn: format(checkIn, 'yyyy-MM-dd'),
          checkOut: format(checkOut, 'yyyy-MM-dd'),
          nights,
          guestCount,
          guest: {
            email: guestForm.email,
            firstName: guestForm.firstName,
            lastName: guestForm.lastName,
            phone: guestForm.phone,
            notes: guestForm.notes || undefined,
          },
          pricing: {
            subtotal: pricing.subtotal,
            cleaningFee: pricing.cleaningFee,
            discount: pricing.discount,
            total: pricing.total,
            nights: pricing.nights,
          },
          couponId: coupon?.id,
          couponCode: coupon?.code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError(err instanceof Error ? err.message : 'Failed to start checkout');
      setCheckoutLoading(false);
    }
  };

  return (
    <Layout>
      <div className="py-8 md:py-12">
        <Container size="md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-text-primary mb-2">
              Book Your Stay
            </h1>
            <p className="text-text-secondary">
              Peaceful studio retreat in the heart of San Francisco
            </p>
          </div>

          {/* Cancelled Message */}
          {wasCancelled && (
            <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg text-center">
              <p className="text-warning font-medium">Payment was cancelled. Your booking has not been confirmed.</p>
              <p className="text-sm text-text-secondary mt-1">Feel free to try again when you're ready.</p>
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {(['dates', 'details', 'review'] as BookingStep[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => {
                    if (s === 'dates') setStep('dates');
                    else if (s === 'details' && checkIn && checkOut) setStep('details');
                    else if (s === 'review' && checkIn && checkOut && validateForm()) setStep('review');
                  }}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-colors
                    ${step === s
                      ? 'bg-accent text-white'
                      : i < ['dates', 'details', 'review'].indexOf(step)
                      ? 'bg-accent/20 text-accent'
                      : 'bg-surface text-text-secondary'
                    }
                  `}
                >
                  {i + 1}
                </button>
                {i < 2 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    i < ['dates', 'details', 'review'].indexOf(step) ? 'bg-accent' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1: Date Selection */}
              {step === 'dates' && (
                <>
                  {/* Date Picker */}
                  <div className="bg-white rounded-xl border border-border p-6">
                    <h2 className="text-xl font-semibold text-text-primary mb-4">
                      Select Your Dates
                    </h2>
                    <p className="text-sm text-text-secondary mb-4">
                      {!checkIn
                        ? 'Click to select your check-in date'
                        : !checkOut
                        ? 'Now select your check-out date'
                        : `${nights} night${nights !== 1 ? 's' : ''} selected`}
                    </p>

                    <AvailabilityCalendar
                      onDateSelect={handleDateSelect}
                      selectedDates={{ checkIn, checkOut }}
                      showLegend={true}
                    />

                    {dateError && (
                      <p className="mt-4 text-sm text-error">{dateError}</p>
                    )}

                    {checkIn && checkOut && (
                      <div className="mt-4 p-4 bg-surface rounded-lg">
                        <div className="flex justify-between text-sm">
                          <div>
                            <span className="text-text-secondary">Check-in:</span>
                            <span className="ml-2 font-medium">{format(checkIn, 'EEE, MMM d, yyyy')}</span>
                          </div>
                          <div>
                            <span className="text-text-secondary">Check-out:</span>
                            <span className="ml-2 font-medium">{format(checkOut, 'EEE, MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Guest Count */}
                  <div className="bg-white rounded-xl border border-border p-6">
                    <h2 className="text-xl font-semibold text-text-primary mb-4">
                      Number of Guests
                    </h2>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                        disabled={guestCount <= 1}
                        className="w-10 h-10 rounded-lg border border-border flex items-center justify-center
                          hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-xl font-medium w-12 text-center">{guestCount}</span>
                      <button
                        onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                        disabled={guestCount >= maxGuests}
                        className="w-10 h-10 rounded-lg border border-border flex items-center justify-center
                          hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <span className="text-sm text-text-secondary">Maximum {maxGuests} guests</span>
                    </div>
                  </div>

                  {/* Coupon Code */}
                  <div className="bg-white rounded-xl border border-border p-6">
                    <h2 className="text-xl font-semibold text-text-primary mb-4">
                      Have a Coupon?
                    </h2>
                    {coupon ? (
                      <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-medium text-success">
                            {coupon.code} applied
                            {coupon.discount_type === 'percentage'
                              ? ` (${coupon.discount_value}% off)`
                              : ` ($${coupon.discount_value} off)`
                            }
                          </span>
                        </div>
                        <button
                          onClick={handleRemoveCoupon}
                          className="text-sm text-text-secondary hover:text-error transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Enter coupon code"
                          className="flex-1 px-4 py-2 rounded-lg border border-border
                            focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
                            text-text-primary placeholder:text-text-secondary"
                        />
                        <Button
                          variant="outline"
                          onClick={handleApplyCoupon}
                          isLoading={couponLoading}
                          disabled={!couponCode.trim() || !checkIn || !checkOut}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                    {couponError && (
                      <p className="mt-2 text-sm text-error">{couponError}</p>
                    )}
                  </div>

                  {/* Continue Button */}
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleContinueToDetails}
                    disabled={!checkIn || !checkOut}
                  >
                    Continue to Guest Details
                  </Button>
                </>
              )}

              {/* Step 2: Guest Details */}
              {step === 'details' && (
                <>
                  <div className="bg-white rounded-xl border border-border p-6">
                    <h2 className="text-xl font-semibold text-text-primary mb-6">
                      Guest Information
                    </h2>

                    {existingGuest && (
                      <div className="mb-6 p-3 bg-accent/10 rounded-lg text-sm text-accent">
                        Welcome back! We've filled in your details.
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
                          Email Address
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={guestForm.email}
                          onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                          onBlur={handleEmailBlur}
                          className={`w-full px-4 py-2 rounded-lg border
                            focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
                            ${formErrors.email ? 'border-error' : 'border-border'}`}
                          placeholder="your@email.com"
                        />
                        {formErrors.email && (
                          <p className="mt-1 text-sm text-error">{formErrors.email}</p>
                        )}
                      </div>

                      {/* Name Row */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="firstName" className="block text-sm font-medium text-text-primary mb-1">
                            First Name
                          </label>
                          <input
                            id="firstName"
                            type="text"
                            value={guestForm.firstName}
                            onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                            className={`w-full px-4 py-2 rounded-lg border
                              focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
                              ${formErrors.firstName ? 'border-error' : 'border-border'}`}
                            placeholder="John"
                          />
                          {formErrors.firstName && (
                            <p className="mt-1 text-sm text-error">{formErrors.firstName}</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="lastName" className="block text-sm font-medium text-text-primary mb-1">
                            Last Name
                          </label>
                          <input
                            id="lastName"
                            type="text"
                            value={guestForm.lastName}
                            onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                            className={`w-full px-4 py-2 rounded-lg border
                              focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
                              ${formErrors.lastName ? 'border-error' : 'border-border'}`}
                            placeholder="Doe"
                          />
                          {formErrors.lastName && (
                            <p className="mt-1 text-sm text-error">{formErrors.lastName}</p>
                          )}
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-1">
                          Phone Number
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          value={guestForm.phone}
                          onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                          className={`w-full px-4 py-2 rounded-lg border
                            focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
                            ${formErrors.phone ? 'border-error' : 'border-border'}`}
                          placeholder="(555) 123-4567"
                        />
                        {formErrors.phone && (
                          <p className="mt-1 text-sm text-error">{formErrors.phone}</p>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-text-primary mb-1">
                          Special Requests <span className="text-text-secondary font-normal">(optional)</span>
                        </label>
                        <textarea
                          id="notes"
                          value={guestForm.notes}
                          onChange={(e) => setGuestForm({ ...guestForm, notes: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 rounded-lg border border-border
                            focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
                            resize-none"
                          placeholder="Any special requests or questions?"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1"
                      onClick={() => setStep('dates')}
                    >
                      Back
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1"
                      onClick={handleContinueToReview}
                    >
                      Review Booking
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3: Review */}
              {step === 'review' && (
                <>
                  <div className="bg-white rounded-xl border border-border p-6">
                    <h2 className="text-xl font-semibold text-text-primary mb-6">
                      Review Your Booking
                    </h2>

                    {/* Stay Details */}
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-text-secondary">Check-in</span>
                        <span className="font-medium">{checkIn && format(checkIn, 'EEE, MMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-text-secondary">Check-out</span>
                        <span className="font-medium">{checkOut && format(checkOut, 'EEE, MMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-text-secondary">Duration</span>
                        <span className="font-medium">{nights} night{nights !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-text-secondary">Guests</span>
                        <span className="font-medium">{guestCount} guest{guestCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Guest Info */}
                    <div className="p-4 bg-surface rounded-lg">
                      <h3 className="font-medium text-text-primary mb-2">Guest</h3>
                      <p className="text-text-secondary">{guestForm.firstName} {guestForm.lastName}</p>
                      <p className="text-text-secondary text-sm">{guestForm.email}</p>
                      <p className="text-text-secondary text-sm">{guestForm.phone}</p>
                      {guestForm.notes && (
                        <p className="text-text-secondary text-sm mt-2 italic">"{guestForm.notes}"</p>
                      )}
                    </div>
                  </div>

                  {/* Checkout Error */}
                  {checkoutError && (
                    <div className="p-4 bg-error/10 border border-error/30 rounded-lg">
                      <p className="text-error text-sm">{checkoutError}</p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1"
                      onClick={() => setStep('details')}
                      disabled={checkoutLoading}
                    >
                      Back
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1"
                      onClick={handleProceedToPayment}
                      isLoading={checkoutLoading}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? 'Redirecting...' : 'Proceed to Payment'}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Sidebar - Price Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-border p-6 sticky top-24">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Price Summary
                </h3>

                {pricing && nights > 0 ? (
                  <div className="space-y-3">
                    {/* Nightly Breakdown */}
                    <div className="space-y-2 pb-3 border-b border-border">
                      {pricing.nights.map((night) => (
                        <div key={night.date} className="flex justify-between text-sm">
                          <span className="text-text-secondary">
                            {format(new Date(night.date), 'MMM d')}
                          </span>
                          <span>${night.rate.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Subtotal */}
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Subtotal</span>
                      <span>${pricing.subtotal.toFixed(2)}</span>
                    </div>

                    {/* Cleaning Fee */}
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Cleaning fee</span>
                      <span>${pricing.cleaningFee.toFixed(2)}</span>
                    </div>

                    {/* Discount */}
                    {pricing.discount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Discount</span>
                        <span>-${pricing.discount.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between pt-3 border-t border-border">
                      <span className="font-semibold text-lg">Total</span>
                      <span className="font-semibold text-lg">${pricing.total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm">
                    Select dates to see pricing
                  </p>
                )}

                {/* Info */}
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-start gap-2 text-sm text-text-secondary">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      Minimum stay: {minNights} nights<br />
                      Check-in: 3:00 PM<br />
                      Check-out: 11:00 AM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </Layout>
  );
}
