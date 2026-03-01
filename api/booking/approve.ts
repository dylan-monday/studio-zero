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
      // Approve the booking
      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          approval_token: null, // Invalidate token after use
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
      // Decline the booking - process refund
      if (booking.stripe_payment_intent) {
        try {
          await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent,
          });
        } catch (refundError) {
          console.error('Refund failed:', refundError);
          return redirectWithMessage(
            res,
            appUrl,
            'error',
            'Failed to process refund. Please check Stripe dashboard.'
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
          total_amount: booking.total_amount,
        },
      });

      return redirectWithMessage(
        res,
        appUrl,
        'success',
        `Booking declined. ${guest.first_name} ${guest.last_name} has been refunded and notified.`
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
      from: { email: 'bookings@studiozerosf.com', name: 'Studio Zero SF' },
      to: guestEmail,
      subject: 'Your Booking is Confirmed! - Studio Zero SF',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #dcfce7; padding: 12px; border-radius: 50%;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px; text-align: center;">
            You're all set, ${guestName}!
          </h1>

          <p style="color: #4a4a4a; text-align: center; margin-bottom: 24px;">
            Your booking has been confirmed. We're excited to host you!
          </p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Booking Details</h2>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Check-in:</strong> ${checkInDate} at 3:00 PM</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Check-out:</strong> ${checkOutDate} at 11:00 AM</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Guests:</strong> ${booking.guests_count}</p>
            <p style="margin: 8px 0; color: #4a4a4a;"><strong>Total:</strong> $${booking.total_amount.toFixed(2)}</p>
          </div>

          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">What's Next?</h2>
            <p style="margin: 8px 0; color: #4a4a4a;">
              You'll receive check-in instructions and access details 24 hours before your arrival.
            </p>
            <p style="margin: 8px 0; color: #4a4a4a;">
              Have questions before then? Just reply to this email.
            </p>
          </div>

          <p style="color: #888; font-size: 12px; margin-top: 32px; text-align: center;">
            Studio Zero SF<br>
            San Francisco, CA<br><br>
            Booking ID: ${booking.id}
          </p>
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
    total_amount: number;
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
      from: { email: 'bookings@studiozerosf.com', name: 'Studio Zero SF' },
      to: guestEmail,
      subject: 'Booking Update - Studio Zero SF',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">
            Hi ${guestName},
          </h1>

          <p style="color: #4a4a4a; line-height: 1.6; margin-bottom: 24px;">
            Unfortunately, we're unable to accommodate your booking request for
            ${checkInDate} - ${checkOutDate}.
          </p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Refund Information</h2>
            <p style="margin: 8px 0; color: #4a4a4a;">
              A full refund of <strong>$${booking.total_amount.toFixed(2)}</strong> has been issued to your original payment method.
            </p>
            <p style="margin: 8px 0; color: #4a4a4a; font-size: 14px;">
              Please allow 5-10 business days for the refund to appear on your statement.
            </p>
          </div>

          <p style="color: #4a4a4a; line-height: 1.6;">
            We apologize for any inconvenience. Feel free to book again for different dates
            if you're still planning a trip to San Francisco.
          </p>

          <p style="color: #888; font-size: 12px; margin-top: 32px;">
            Studio Zero SF<br>
            San Francisco, CA
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Failed to send decline email:', err);
  }
}
