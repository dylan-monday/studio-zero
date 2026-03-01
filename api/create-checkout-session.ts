import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

interface CheckoutRequest {
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  guest: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    notes?: string;
  };
  pricing: {
    subtotal: number;
    cleaningFee: number;
    discount: number;
    total: number;
    nights: Array<{ date: string; rate: number }>;
  };
  couponId?: string;
  couponCode?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as CheckoutRequest;
    const { checkIn, checkOut, nights, guestCount, guest, pricing, couponId, couponCode } = body;

    // Validate required fields
    if (!checkIn || !checkOut || !guest?.email || !pricing?.total) {
      return res.status(400).json({ error: 'Missing required booking data' });
    }

    const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';

    // Build line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Add each night as a line item for transparency
    for (const night of pricing.nights) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(night.rate * 100), // Convert to cents
          product_data: {
            name: `Studio Zero - ${night.date}`,
            description: 'Nightly accommodation',
          },
        },
        quantity: 1,
      });
    }

    // Add cleaning fee
    if (pricing.cleaningFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(pricing.cleaningFee * 100),
          product_data: {
            name: 'Cleaning Fee',
            description: 'One-time cleaning fee',
          },
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: guest.email,
      line_items: lineItems,
      success_url: `${appUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/book?cancelled=true`,
      metadata: {
        checkIn,
        checkOut,
        nights: nights.toString(),
        guestCount: guestCount.toString(),
        guestEmail: guest.email,
        guestFirstName: guest.firstName,
        guestLastName: guest.lastName,
        guestPhone: guest.phone,
        guestNotes: guest.notes || '',
        subtotal: pricing.subtotal.toString(),
        cleaningFee: pricing.cleaningFee.toString(),
        discount: pricing.discount.toString(),
        total: pricing.total.toString(),
        couponId: couponId || '',
        couponCode: couponCode || '',
        nightlyRates: JSON.stringify(pricing.nights),
      },
      payment_intent_data: {
        capture_method: 'manual', // Authorize only — capture on owner approval
        metadata: {
          checkIn,
          checkOut,
          guestEmail: guest.email,
        },
      },
    };

    // Apply discount if present
    if (pricing.discount > 0 && couponCode) {
      // Create a Stripe coupon for this session
      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(pricing.discount * 100),
        currency: 'usd',
        duration: 'once',
        name: couponCode,
      });

      sessionParams.discounts = [{ coupon: stripeCoupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Checkout session error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
