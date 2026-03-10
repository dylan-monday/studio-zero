import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin operations
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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
      amount_paid: 0, // Authorization hold only — captured on approval
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
    await sgMail.send({
      from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      to: ownerEmail,
      subject: `New Booking Request — ${guestName}`,
      html: `
        <div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">
          <div style="text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 1px solid #e2dfd9;">
            <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.02em;">Studio Zero</p>
          </div>
          <div style="margin-bottom: 32px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 8px 0;">New Request</p>
            <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.01em;">Booking Request</h1>
          </div>

          <div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 24px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">Guest</p>
            <p style="margin: 6px 0; color: #1c1917; font-size: 15px; line-height: 1.6;">${guestName}</p>
            <p style="margin: 6px 0; color: #78716c; font-size: 14px; line-height: 1.6;">${guestEmail} &middot; ${guestPhone}</p>
            ${guestNotes ? `<p style="margin: 12px 0 0 0; color: #78716c; font-size: 14px; line-height: 1.6; font-style: italic;">"${guestNotes}"</p>` : ''}
          </div>

          <div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 24px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">Stay Details</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-in</td>
                <td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${checkInDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-out</td>
                <td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${checkOutDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Guests</td>
                <td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${booking.guests_count}</td>
              </tr>
              <tr style="border-top: 1px solid #e2dfd9;">
                <td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500;">Total</td>
                <td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500; text-align: right;">$${booking.total_amount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="color: #78716c; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
            Card has been authorized but not charged. Approving will capture the payment. Declining will release the hold.
          </p>

          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${approveUrl}" style="display: inline-block; background: #1c1917; color: #faf9f7; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; margin-right: 8px;">
              Approve
            </a>
            <a href="${declineUrl}" style="display: inline-block; background: transparent; color: #1c1917; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; border: 1px solid #e2dfd9;">
              Decline
            </a>
          </div>

          <p style="font-family: monospace; font-size: 10px; color: #78716c; text-align: center; letter-spacing: 0.1em; margin: 0;">
            ${booking.id}
          </p>
        </div>
      `,
    });
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
    await sgMail.send({
      from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      to: guestEmail,
      subject: 'Booking Request Received — Studio Zero SF',
      html: `
        <div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">
          <div style="text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 1px solid #e2dfd9;">
            <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.02em;">Studio Zero</p>
          </div>
          <div style="margin-bottom: 32px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 8px 0;">Booking Received</p>
            <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.01em;">Thanks, ${guestName}</h1>
          </div>

          <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">
            We've received your booking request. Your card has been authorized but won't be charged until the host confirms your stay. You'll hear back shortly.
          </p>

          <div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 28px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">Your Stay</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-in</td>
                <td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${checkInDate} at 3:00 PM</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-out</td>
                <td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${checkOutDate} at 11:00 AM</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #78716c; font-size: 14px;">Guests</td>
                <td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${booking.guests_count}</td>
              </tr>
              <tr style="border-top: 1px solid #e2dfd9;">
                <td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500;">Total</td>
                <td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500; text-align: right;">$${booking.total_amount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="color: #78716c; font-size: 14px; line-height: 1.65;">
            Questions? Just reply to this email.
          </p>

          <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
            <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Error sending guest email:', err);
  }
}
