import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import {
  fetchEmailContent,
  buildGuestConfirmedHtml,
  buildGuestDeclinedHtml,
} from '../_lib/email-templates';

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
