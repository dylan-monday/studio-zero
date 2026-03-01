import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
// ---------------------------------------------------------------------------
// Inlined email template types, defaults, helpers, and builders
// (from api/_lib/email-templates.ts — inlined for Vercel serverless compat)
// ---------------------------------------------------------------------------

interface GuestPendingContent {
  subject: string;
  body: string;
  footer: string;
}

interface OwnerApprovalContent {
  subject_template: string;
  auth_note: string;
  approve_label: string;
  decline_label: string;
}

const DEFAULT_GUEST_PENDING: GuestPendingContent = {
  subject: 'We got your request for Studio Zero',
  body: "Thanks for booking Studio Zero! We've received your request. We'll confirm your reservation within 24 hours. You'll get another email as soon as we do.",
  footer: 'If you have any questions in the meantime, just reply to this email.',
};

const DEFAULT_OWNER_APPROVAL: OwnerApprovalContent = {
  subject_template: 'New booking request: {guest_name}, {check_in}',
  auth_note: 'Card has been authorized but not charged. Approving will capture the payment. Declining will release the hold.',
  approve_label: 'Approve',
  decline_label: 'Decline',
};

async function fetchEmailContent(supabase: any): Promise<{ guest_pending: GuestPendingContent; owner_approval: OwnerApprovalContent }> {
  const keys = ['email_content_guest_pending', 'email_content_owner_approval'];
  const { data } = await supabase.from('settings').select('key, value').in('key', keys);

  const stored: Record<string, unknown> = {};
  if (data) {
    for (const row of data) {
      stored[row.key] = row.value;
    }
  }

  return {
    guest_pending: { ...DEFAULT_GUEST_PENDING, ...(stored['email_content_guest_pending'] as object || {}) },
    owner_approval: { ...DEFAULT_OWNER_APPROVAL, ...(stored['email_content_owner_approval'] as object || {}) },
  };
}

// Styling helpers

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function emailWrapper(inner: string): string {
  return `<div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">${inner}</div>`;
}

function sectionLabel(text: string): string {
  return `<p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 8px 0;">${text}</p>`;
}

function heading(text: string): string {
  return `<h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.01em;">${text}</h1>`;
}

function bodyText(text: string): string {
  return `<p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">${text}</p>`;
}

function smallText(text: string): string {
  return `<p style="color: #78716c; font-size: 14px; line-height: 1.65; margin: 0 0 8px 0;">${text}</p>`;
}

function divider(): string {
  return `<div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 24px;">`;
}

function sectionStart(label: string): string {
  return `${divider()}<p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">${label}</p>`;
}

function footer(): string {
  return `
    <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
      <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
      <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA</p>
    </div>`;
}

function bookingTable(checkIn: string, checkOut: string, guestsCount: number, totalAmount: number, totalLabel: string = 'Total'): string {
  return `
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-in</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${formatDate(checkIn)} at 3:00 PM</td></tr>
      <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-out</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${formatDate(checkOut)} at 11:00 AM</td></tr>
      <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Guests</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${guestsCount}</td></tr>
      <tr style="border-top: 1px solid #e2dfd9;"><td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500;">${totalLabel}</td><td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500; text-align: right;">$${totalAmount.toFixed(2)}</td></tr>
    </table>`;
}

function primaryButton(url: string, text: string): string {
  return `<a href="${url}" style="display: inline-block; background: #1c1917; color: #faf9f7; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em;">${text}</a>`;
}

function outlineButton(url: string, text: string): string {
  return `<a href="${url}" style="display: inline-block; background: transparent; color: #1c1917; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; border: 1px solid #e2dfd9;">${text}</a>`;
}

// Email builders

interface BookingData {
  id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  total_amount: number;
}

function buildGuestPendingHtml(
  content: GuestPendingContent,
  data: { guestName: string; booking: BookingData },
): string {
  return emailWrapper(`
    <div style="margin-bottom: 32px;">
      ${sectionLabel('Booking Received')}
      ${heading(`Hi ${data.guestName},`)}
    </div>
    ${bodyText(content.body)}
    ${sectionStart('Your Stay')}
      ${bookingTable(data.booking.check_in, data.booking.check_out, data.booking.guests_count, data.booking.total_amount)}
    </div>
    <p style="color: #78716c; font-size: 14px; line-height: 1.65; margin-top: 28px;">${content.footer}</p>
    ${footer()}
  `);
}

interface OwnerApprovalData {
  booking: BookingData;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNotes: string | null;
  approveUrl: string;
  declineUrl: string;
}

function buildOwnerApprovalHtml(
  content: OwnerApprovalContent,
  data: OwnerApprovalData,
): string {
  return emailWrapper(`
    <div style="margin-bottom: 32px;">
      ${sectionLabel('New Request')}
      ${heading('Booking Request')}
    </div>

    ${sectionStart('Guest')}
      <p style="margin: 6px 0; color: #1c1917; font-size: 15px; line-height: 1.6;">${data.guestName}</p>
      <p style="margin: 6px 0; color: #78716c; font-size: 14px; line-height: 1.6;">${data.guestEmail} &middot; ${data.guestPhone}</p>
      ${data.guestNotes ? `<p style="margin: 12px 0 0 0; color: #78716c; font-size: 14px; line-height: 1.6; font-style: italic;">"${data.guestNotes}"</p>` : ''}
    </div>

    ${sectionStart('Stay Details')}
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-in</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${formatDate(data.booking.check_in)}</td></tr>
        <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-out</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${formatDate(data.booking.check_out)}</td></tr>
        <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Guests</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${data.booking.guests_count}</td></tr>
        <tr style="border-top: 1px solid #e2dfd9;"><td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500;">Total</td><td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500; text-align: right;">$${data.booking.total_amount.toFixed(2)}</td></tr>
      </table>
    </div>

    ${bodyText(content.auth_note)}

    <div style="text-align: center; margin-bottom: 32px;">
      ${primaryButton(data.approveUrl, content.approve_label)}
      <span style="display: inline-block; width: 8px;"></span>
      ${outlineButton(data.declineUrl, content.decline_label)}
    </div>

    <p style="font-family: monospace; font-size: 10px; color: #78716c; text-align: center; letter-spacing: 0.1em; margin: 0;">${data.booking.id}</p>
  `);
}

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
