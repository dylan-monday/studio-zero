import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin operations
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const signature = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  let rawBody: Buffer;

  try {
    rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      await handleCheckoutCompleted(session);
    } catch (err) {
      console.error('Error processing checkout:', err);
      return res.status(500).json({ error: 'Error processing checkout' });
    }
  }

  return res.status(200).json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata!;

  // Extract booking data from metadata
  const checkIn = metadata.checkIn;
  const checkOut = metadata.checkOut;
  const guestCount = parseInt(metadata.guestCount, 10);
  const guestEmail = metadata.guestEmail;
  const guestFirstName = metadata.guestFirstName;
  const guestLastName = metadata.guestLastName;
  const guestPhone = metadata.guestPhone;
  const guestNotes = metadata.guestNotes || null;
  const subtotal = parseFloat(metadata.subtotal);
  const cleaningFee = parseFloat(metadata.cleaningFee);
  const discount = parseFloat(metadata.discount);
  const total = parseFloat(metadata.total);
  const couponId = metadata.couponId || null;
  const nightlyRates = JSON.parse(metadata.nightlyRates) as Array<{ date: string; rate: number }>;

  // Calculate average nightly rate for storage
  const avgNightlyRate = nightlyRates.length > 0
    ? nightlyRates.reduce((sum, n) => sum + n.rate, 0) / nightlyRates.length
    : 0;

  // 1. Create or update guest
  const { data: existingGuest } = await supabase
    .from('guests')
    .select('id')
    .eq('email', guestEmail.toLowerCase())
    .single();

  let guestId: string;

  if (existingGuest) {
    // Update existing guest
    guestId = existingGuest.id;
    await supabase
      .from('guests')
      .update({
        first_name: guestFirstName,
        last_name: guestLastName,
        phone: guestPhone,
      })
      .eq('id', guestId);
  } else {
    // Create new guest
    const { data: newGuest, error: guestError } = await supabase
      .from('guests')
      .insert({
        email: guestEmail.toLowerCase(),
        first_name: guestFirstName,
        last_name: guestLastName,
        phone: guestPhone,
      })
      .select('id')
      .single();

    if (guestError || !newGuest) {
      throw new Error(`Failed to create guest: ${guestError?.message}`);
    }
    guestId = newGuest.id;
  }

  // 2. Generate approval token
  const approvalToken = crypto.randomBytes(32).toString('hex');

  // 3. Create booking record
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      guest_id: guestId,
      check_in: checkIn,
      check_out: checkOut,
      guests_count: guestCount,
      status: 'pending', // Awaiting owner approval
      nightly_rate: avgNightlyRate,
      subtotal: subtotal,
      discount_amount: discount,
      cleaning_fee: cleaningFee,
      total_amount: total,
      amount_paid: total,
      stripe_checkout_id: session.id,
      stripe_payment_intent: session.payment_intent as string,
      coupon_id: couponId || null,
      guest_notes: guestNotes,
      approval_token: approvalToken,
    })
    .select()
    .single();

  if (bookingError || !booking) {
    throw new Error(`Failed to create booking: ${bookingError?.message}`);
  }

  // 4. Increment coupon usage if applicable
  if (couponId) {
    await supabase.rpc('increment_coupon_usage', { coupon_uuid: couponId });
  }

  // 5. Send emails
  const appUrl = process.env.VITE_APP_URL || 'https://studiozerosf.com';
  const ownerEmail = process.env.OWNER_EMAIL || 'dylan@dylandibona.com';

  // Owner approval email
  await sendOwnerApprovalEmail({
    ownerEmail,
    booking,
    guestName: `${guestFirstName} ${guestLastName}`,
    guestEmail,
    guestPhone,
    guestNotes,
    approveUrl: `${appUrl}/api/booking/approve?token=${approvalToken}&action=approve`,
    declineUrl: `${appUrl}/api/booking/approve?token=${approvalToken}&action=decline`,
  });

  // Guest confirmation email (pending approval)
  await sendGuestPendingEmail({
    guestEmail,
    guestName: guestFirstName,
    booking,
  });

  console.log(`Booking created: ${booking.id} for ${guestEmail}`);
}

interface OwnerEmailParams {
  ownerEmail: string;
  booking: {
    id: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    total_amount: number;
  };
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNotes: string | null;
  approveUrl: string;
  declineUrl: string;
}

async function sendOwnerApprovalEmail(params: OwnerEmailParams) {
  const { ownerEmail, booking, guestName, guestEmail, guestPhone, guestNotes, approveUrl, declineUrl } = params;

  const checkInDate = new Date(booking.check_in).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: 'Studio Zero SF <bookings@studiozerosf.com>',
      to: ownerEmail,
      subject: `New Booking Request - ${guestName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">New Booking Request</h1>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Guest Details</h2>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Name:</strong> ${guestName}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Email:</strong> ${guestEmail}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Phone:</strong> ${guestPhone}</p>
            ${guestNotes ? `<p style="margin: 8px 0; color: #4a4a4a;"><strong>Notes:</strong> ${guestNotes}</p>` : ''}
          </div>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Booking Details</h2>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Check-in:</strong> ${checkInDate}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Check-out:</strong> ${checkOutDate}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Guests:</strong> ${booking.guests_count}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Total:</strong> $${booking.total_amount.toFixed(2)}</p>
          </div>

          <p style="color: #4a4a4a; margin-bottom: 24px;">Payment has been collected. Please approve or decline this booking.</p>

          <div style="text-align: center;">
            <a href="${approveUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-right: 12px;">
              Approve Booking
            </a>
            <a href="${declineUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Decline Booking
            </a>
          </div>

          <p style="color: #888; font-size: 12px; margin-top: 32px; text-align: center;">
            Booking ID: ${booking.id}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send owner email:', error);
    }

    return data;
  } catch (err) {
    console.error('Error sending owner email:', err);
  }
}

interface GuestEmailParams {
  guestEmail: string;
  guestName: string;
  booking: {
    id: string;
    check_in: string;
    check_out: string;
    guests_count: number;
    total_amount: number;
  };
}

async function sendGuestPendingEmail(params: GuestEmailParams) {
  const { guestEmail, guestName, booking } = params;

  const checkInDate = new Date(booking.check_in).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: 'Studio Zero SF <bookings@studiozerosf.com>',
      to: guestEmail,
      subject: 'Your Booking Request - Studio Zero SF',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Thanks for your booking, ${guestName}!</h1>

          <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
            We've received your booking request and your payment has been processed.
            The host will review your request and you'll receive a confirmation email shortly.
          </p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Your Stay</h2>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Check-in:</strong> ${checkInDate} at 3:00 PM</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Check-out:</strong> ${checkOutDate} at 11:00 AM</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Guests:</strong> ${booking.guests_count}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Total Paid:</strong> $${booking.total_amount.toFixed(2)}</p>
          </div>

          <p style="color: #4a4a4a; line-height: 1.6;">
            Questions? Reply to this email and we'll get back to you soon.
          </p>

          <p style="color: #888; font-size: 12px; margin-top: 32px;">
            Studio Zero SF<br>
            San Francisco, CA
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send guest email:', error);
    }

    return data;
  } catch (err) {
    console.error('Error sending guest email:', err);
  }
}
