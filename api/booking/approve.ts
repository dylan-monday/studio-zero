import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

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
      await sendGuestConfirmationEmail({
        guestEmail: guest.email,
        guestName: guest.first_name,
        booking: {
          id: booking.id,
          check_in: booking.check_in,
          check_out: booking.check_out,
          guests_count: booking.guests_count,
          total_amount: booking.total_amount,
        },
      });

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
      await sendGuestDeclineEmail({
        guestEmail: guest.email,
        guestName: guest.first_name,
        booking: {
          check_in: booking.check_in,
          check_out: booking.check_out,
        },
      });

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

interface GuestConfirmationParams {
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

async function sendGuestConfirmationEmail(params: GuestConfirmationParams) {
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
      subject: 'Booking Confirmed — Studio Zero SF',
      html: `
        <div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">
          <div style="text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 1px solid #e2dfd9;">
            <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.02em;">Studio Zero</p>
          </div>
          <div style="margin-bottom: 32px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 8px 0;">Confirmed</p>
            <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.01em;">You're all set, ${guestName}</h1>
          </div>

          <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">
            Your booking has been confirmed and your card has been charged. We're looking forward to hosting you.
          </p>

          <div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 28px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">Booking Details</p>
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
                <td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500;">Total Charged</td>
                <td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500; text-align: right;">$${booking.total_amount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 28px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">What's Next</p>
            <p style="color: #78716c; font-size: 14px; line-height: 1.65; margin: 0 0 8px 0;">
              You'll receive check-in instructions and access details 24 hours before your arrival.
            </p>
            <p style="color: #78716c; font-size: 14px; line-height: 1.65; margin: 0;">
              Questions before then? Just reply to this email.
            </p>
          </div>

          <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
            <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA &middot; ${booking.id}</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send confirmation email:', err);
  }
}

interface GuestDeclineParams {
  guestEmail: string;
  guestName: string;
  booking: {
    check_in: string;
    check_out: string;
  };
}

async function sendGuestDeclineEmail(params: GuestDeclineParams) {
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
      subject: 'Booking Update — Studio Zero SF',
      html: `
        <div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">
          <div style="text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 1px solid #e2dfd9;">
            <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.02em;">Studio Zero</p>
          </div>
          <div style="margin-bottom: 32px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 8px 0;">Update</p>
            <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.01em;">Hi ${guestName},</h1>
          </div>

          <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">
            Unfortunately, we're unable to accommodate your booking for ${checkInDate} through ${checkOutDate}. Your card was never charged — the authorization hold has been released.
          </p>

          <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">
            We'd love to host you another time. Feel free to check availability for different dates.
          </p>

          <div style="text-align: center; margin-bottom: 32px;">
            <a href="https://studiozerosf.com/book" style="display: inline-block; background: #1c1917; color: #faf9f7; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em;">
              Check Availability
            </a>
          </div>

          <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
            <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
            <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send decline email:', err);
  }
}
