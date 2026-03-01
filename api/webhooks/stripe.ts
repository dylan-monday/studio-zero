import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import {
  fetchEmailContent,
  buildGuestPendingHtml,
  buildOwnerApprovalHtml,
} from '../_lib/email-templates';

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

  // 5. Send emails using shared templates
  const appUrl = process.env.VITE_APP_URL || 'https://studiozerosf.com';
  const ownerEmail = process.env.OWNER_EMAIL || 'dylan@dylandibona.com';
  const emailContent = await fetchEmailContent(supabase);

  const bookingData = {
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    guests_count: booking.guests_count,
    total_amount: booking.total_amount,
  };

  const guestFullName = `${guestFirstName} ${guestLastName}`;

  // Owner approval email
  const ownerSubject = emailContent.owner_approval.subject_template
    .replace('{guest_name}', guestFullName)
    .replace('{check_in}', new Date(checkIn + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

  try {
    await sgMail.send({
      from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      to: ownerEmail,
      subject: ownerSubject,
      html: buildOwnerApprovalHtml(emailContent.owner_approval, {
        booking: bookingData,
        guestName: guestFullName,
        guestEmail,
        guestPhone,
        guestNotes,
        approveUrl: `${appUrl}/api/booking/approve?token=${approvalToken}&action=approve`,
        declineUrl: `${appUrl}/api/booking/approve?token=${approvalToken}&action=decline`,
      }),
    });
  } catch (err) {
    console.error('Error sending owner email:', err);
  }

  // Guest pending email
  try {
    await sgMail.send({
      from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      to: guestEmail,
      subject: emailContent.guest_pending.subject,
      html: buildGuestPendingHtml(emailContent.guest_pending, {
        guestName: guestFirstName,
        booking: bookingData,
      }),
    });
  } catch (err) {
    console.error('Error sending guest email:', err);
  }

  console.log(`Booking created: ${booking.id} for ${guestEmail}`);
}
