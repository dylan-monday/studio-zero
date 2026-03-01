import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
// ---------------------------------------------------------------------------
// Inlined email-template types & helpers (avoids cross-file import on Vercel)
// ---------------------------------------------------------------------------

interface GuestConfirmedContent {
  subject: string;
  body: string;
  whats_next: string;
  footer: string;
}

interface GuestDeclinedContent {
  subject: string;
  body: string;
  secondary: string;
  cta_text: string;
}

const DEFAULT_GUEST_CONFIRMED: GuestConfirmedContent = {
  subject: "You're confirmed at Studio Zero",
  body: "Great news — your reservation is confirmed.",
  whats_next: "We'll send you the full address and entry instructions the day before your arrival.",
  footer: 'Questions before then? Just reply to this email.',
};

const DEFAULT_GUEST_DECLINED: GuestDeclinedContent = {
  subject: 'Update on your Studio Zero request',
  body: "Unfortunately, we're not able to confirm your reservation for {dates}. Your payment has been fully refunded — you should see it back in your account within 5–10 business days, depending on your bank.",
  secondary: 'If your dates are flexible, feel free to check availability and try again.',
  cta_text: 'Check Availability',
};

async function fetchEmailContent(supabase: any) {
  const keys = ['email_content_guest_confirmed', 'email_content_guest_declined'];
  const { data } = await supabase.from('settings').select('key, value').in('key', keys);

  const stored: Record<string, unknown> = {};
  if (data) {
    for (const row of data) {
      stored[row.key] = row.value;
    }
  }

  return {
    guest_confirmed: { ...DEFAULT_GUEST_CONFIRMED, ...(stored['email_content_guest_confirmed'] as object || {}) } as GuestConfirmedContent,
    guest_declined: { ...DEFAULT_GUEST_DECLINED, ...(stored['email_content_guest_declined'] as object || {}) } as GuestDeclinedContent,
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

// Email builder data type

interface BookingData {
  id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  total_amount: number;
}

// Email builder: Guest Confirmed

function buildGuestConfirmedHtml(
  content: GuestConfirmedContent,
  data: { guestName: string; booking: BookingData },
): string {
  return emailWrapper(`
    <div style="margin-bottom: 32px;">
      ${sectionLabel('Confirmed')}
      ${heading(`You're all set, ${data.guestName}`)}
    </div>
    ${bodyText(content.body)}
    ${sectionStart('Booking Details')}
      ${bookingTable(data.booking.check_in, data.booking.check_out, data.booking.guests_count, data.booking.total_amount, 'Total Charged')}
    </div>
    ${sectionStart("What's Next")}
      ${smallText(content.whats_next)}
      ${smallText(content.footer)}
    </div>
    <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
      <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
      <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA &middot; ${data.booking.id}</p>
    </div>
  `);
}

// Email builder: Guest Declined

function buildGuestDeclinedHtml(
  content: GuestDeclinedContent,
  data: { guestName: string; booking: { check_in: string; check_out: string } },
): string {
  const dates = `${formatDate(data.booking.check_in)} through ${formatDate(data.booking.check_out)}`;
  const bodyWithDates = content.body.replace('{dates}', dates);

  return emailWrapper(`
    <div style="margin-bottom: 32px;">
      ${sectionLabel('Update')}
      ${heading(`Hi ${data.guestName},`)}
    </div>
    ${bodyText(bodyWithDates)}
    ${bodyText(content.secondary)}
    <div style="text-align: center; margin-bottom: 32px;">
      ${primaryButton('https://studiozerosf.com/book', content.cta_text)}
    </div>
    ${footer()}
  `);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, action } = req.query;
  const appUrl = process.env.VITE_APP_URL || 'https://studiozerosf.com';

  if (!token || typeof token !== 'string') {
    return redirectWithMessage(res, appUrl, 'error', 'Invalid approval link');
  }

  if (action !== 'approve' && action !== 'decline') {
    return redirectWithMessage(res, appUrl, 'error', 'Invalid action');
  }

  try {
    // Find booking by approval token
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        guest:guests(*)
      `)
      .eq('approval_token', token)
      .single();

    if (bookingError || !booking) {
      return redirectWithMessage(res, appUrl, 'error', 'Booking not found');
    }

    // Check if already processed
    if (booking.status !== 'pending') {
      return redirectWithMessage(
        res,
        appUrl,
        'info',
        `This booking has already been ${booking.status}`
      );
    }

    const guest = booking.guest;
    const emailContent = await fetchEmailContent(supabase);

    if (action === 'approve') {
      // Capture the authorized payment
      if (booking.stripe_payment_intent) {
        try {
          await stripe.paymentIntents.capture(booking.stripe_payment_intent);
        } catch (captureError) {
          console.error('Payment capture failed:', captureError);
          return redirectWithMessage(
            res,
            appUrl,
            'error',
            'Failed to capture payment. The authorization may have expired. Please check Stripe dashboard.'
          );
        }
      }

      // Approve the booking
      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          amount_paid: booking.total_amount,
          approval_token: null,
        })
        .eq('id', booking.id);

      // Send confirmation email to guest
      if (guest) {
        try {
          await sgMail.send({
            from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
            replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
            to: guest.email,
            subject: emailContent.guest_confirmed.subject,
            html: buildGuestConfirmedHtml(emailContent.guest_confirmed, {
              guestName: guest.first_name,
              booking: {
                id: booking.id,
                check_in: booking.check_in,
                check_out: booking.check_out,
                guests_count: booking.guests_count,
                total_amount: booking.total_amount,
              },
            }),
          });
        } catch (err) {
          console.error('Failed to send confirmation email:', err);
        }
      }

      return redirectWithMessage(
        res,
        appUrl,
        'success',
        `Booking approved! ${guest.first_name} ${guest.last_name} has been notified.`
      );
    } else {
      // Cancel the authorization hold (no charge, no refund needed)
      if (booking.stripe_payment_intent) {
        try {
          await stripe.paymentIntents.cancel(booking.stripe_payment_intent);
        } catch (cancelError) {
          console.error('Payment cancel failed:', cancelError);
          return redirectWithMessage(
            res,
            appUrl,
            'error',
            'Failed to cancel payment hold. Please check Stripe dashboard.'
          );
        }
      }

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          approval_token: null,
          amount_paid: 0,
        })
        .eq('id', booking.id);

      // Send decline email to guest
      if (guest) {
        try {
          await sgMail.send({
            from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
            replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
            to: guest.email,
            subject: emailContent.guest_declined.subject,
            html: buildGuestDeclinedHtml(emailContent.guest_declined, {
              guestName: guest.first_name,
              booking: {
                check_in: booking.check_in,
                check_out: booking.check_out,
              },
            }),
          });
        } catch (err) {
          console.error('Failed to send decline email:', err);
        }
      }

      return redirectWithMessage(
        res,
        appUrl,
        'success',
        `Booking declined. ${guest.first_name} ${guest.last_name} has been notified.`
      );
    }
  } catch (error) {
    console.error('Approval error:', error);
    return redirectWithMessage(res, appUrl, 'error', 'An error occurred');
  }
}

function redirectWithMessage(
  res: VercelResponse,
  baseUrl: string,
  type: 'success' | 'error' | 'info',
  message: string
) {
  const params = new URLSearchParams({ type, message });
  return res.redirect(302, `${baseUrl}/admin/result?${params.toString()}`);
}
