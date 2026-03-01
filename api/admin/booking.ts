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
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Booking ID required' });
  }

  // GET — fetch single booking
  if (req.method === 'GET') {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`*, guest:guests(*)`)
      .eq('id', id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.status(200).json(booking);
  }

  // PATCH — update booking (status changes, notes, etc.)
  if (req.method === 'PATCH') {
    const { action, admin_notes } = req.body || {};

    // Fetch current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`*, guest:guests(*)`)
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Handle status actions
    if (action === 'approve') {
      if (booking.status !== 'pending') {
        return res.status(400).json({ error: `Cannot approve a ${booking.status} booking` });
      }

      // Capture payment
      if (booking.stripe_payment_intent) {
        try {
          await stripe.paymentIntents.capture(booking.stripe_payment_intent);
        } catch (err) {
          console.error('Payment capture failed:', err);
          return res.status(500).json({ error: 'Failed to capture payment. The authorization may have expired.' });
        }
      }

      await supabase
        .from('bookings')
        .update({ status: 'confirmed', amount_paid: booking.total_amount, approval_token: null })
        .eq('id', id);

      // Send confirmation email
      const guest = booking.guest;
      if (guest) {
        await sendEmail(guest.email, 'Booking Confirmed — Studio Zero SF', confirmationEmailHtml(guest.first_name, booking));
      }

      const { data: updated } = await supabase.from('bookings').select(`*, guest:guests(*)`).eq('id', id).single();
      return res.status(200).json(updated);
    }

    if (action === 'cancel') {
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking` });
      }

      // Cancel or refund based on payment state
      let paymentNote = '';
      if (booking.stripe_payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent);
          if (pi.status === 'requires_capture') {
            // Auth hold — just cancel
            await stripe.paymentIntents.cancel(booking.stripe_payment_intent);
          } else if (pi.status === 'succeeded' && booking.amount_paid > 0) {
            // Already captured — refund
            await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent });
          }
        } catch (err) {
          console.error('Payment cancel/refund failed:', err);
          paymentNote = 'Note: Could not process refund via Stripe (payment intent may be from test mode or expired). Booking cancelled without refund.';
        }
      }

      const cancelUpdate: Record<string, unknown> = { status: 'cancelled', amount_paid: 0, approval_token: null };
      if (paymentNote) {
        const existingNotes = booking.admin_notes || '';
        cancelUpdate.admin_notes = existingNotes ? `${existingNotes}\n\n${paymentNote}` : paymentNote;
      }

      await supabase
        .from('bookings')
        .update(cancelUpdate)
        .eq('id', id);

      // Send decline email
      const guest = booking.guest;
      if (guest) {
        await sendEmail(guest.email, 'Booking Update — Studio Zero SF', declineEmailHtml(guest.first_name, booking));
      }

      const { data: updated } = await supabase.from('bookings').select(`*, guest:guests(*)`).eq('id', id).single();
      return res.status(200).json({ ...updated, warning: paymentNote || undefined });
    }

    if (action === 'complete') {
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ error: `Cannot complete a ${booking.status} booking` });
      }

      await supabase.from('bookings').update({ status: 'completed' }).eq('id', id);
      const { data: updated } = await supabase.from('bookings').select(`*, guest:guests(*)`).eq('id', id).single();
      return res.status(200).json(updated);
    }

    // Just updating notes
    if (admin_notes !== undefined) {
      await supabase.from('bookings').update({ admin_notes }).eq('id', id);
      const { data: updated } = await supabase.from('bookings').select(`*, guest:guests(*)`).eq('id', id).single();
      return res.status(200).json(updated);
    }

    return res.status(400).json({ error: 'No valid action or update provided' });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await sgMail.send({
      from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

function confirmationEmailHtml(guestName: string, booking: any): string {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">
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
          <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-in</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${checkIn} at 3:00 PM</td></tr>
          <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Check-out</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${checkOut} at 11:00 AM</td></tr>
          <tr><td style="padding: 6px 0; color: #78716c; font-size: 14px;">Guests</td><td style="padding: 6px 0; color: #1c1917; font-size: 14px; text-align: right;">${booking.guests_count}</td></tr>
          <tr style="border-top: 1px solid #e2dfd9;"><td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500;">Total Charged</td><td style="padding: 12px 0 6px; color: #1c1917; font-size: 15px; font-weight: 500; text-align: right;">$${booking.total_amount.toFixed(2)}</td></tr>
        </table>
      </div>
      <div style="border-top: 1px solid #e2dfd9; padding-top: 24px; margin-bottom: 28px;">
        <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 12px 0;">What's Next</p>
        <p style="color: #78716c; font-size: 14px; line-height: 1.65; margin: 0 0 8px 0;">You'll receive check-in instructions and access details 24 hours before your arrival.</p>
        <p style="color: #78716c; font-size: 14px; line-height: 1.65; margin: 0;">Questions before then? Just reply to this email.</p>
      </div>
      <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
        <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
        <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA &middot; ${booking.id}</p>
      </div>
    </div>
  `;
}

function declineEmailHtml(guestName: string, booking: any): string {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div style="font-family: 'DM Sans', system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #faf9f7;">
      <div style="margin-bottom: 32px;">
        <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0 0 8px 0;">Update</p>
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1c1917; margin: 0; letter-spacing: -0.01em;">Hi ${guestName},</h1>
      </div>
      <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">
        Unfortunately, we're unable to accommodate your booking for ${checkIn} through ${checkOut}. Your card was never charged — the authorization hold has been released.
      </p>
      <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 0 0 28px 0;">
        We'd love to host you another time. Feel free to check availability for different dates.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="https://studiozerosf.com/book" style="display: inline-block; background: #1c1917; color: #faf9f7; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.02em;">Check Availability</a>
      </div>
      <div style="border-top: 1px solid #e2dfd9; margin-top: 32px; padding-top: 20px;">
        <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #78716c; margin: 0;">Studio Zero SF</p>
        <p style="font-family: monospace; font-size: 10px; color: #78716c; margin: 4px 0 0 0; letter-spacing: 0.1em;">San Francisco, CA</p>
      </div>
    </div>
  `;
}
