import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  fetchEmailContent,
  buildGuestConfirmedHtml,
  buildGuestDeclinedHtml,
} from '../_lib/email-templates';

function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const expected = createHmac('sha256', password).update(email).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      res.status(401).json({ error: 'Unauthorized' }); return false;
    }
  } catch { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
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
  if (!requireAdmin(req, res)) return;

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

      // Send confirmation email using shared template
      const guest = booking.guest;
      if (guest) {
        const emailContent = await fetchEmailContent(supabase);
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

      // Send decline email using shared template
      const guest = booking.guest;
      if (guest) {
        const emailContent = await fetchEmailContent(supabase);
        try {
          await sgMail.send({
            from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
            replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
            to: guest.email,
            subject: emailContent.guest_declined.subject,
            html: buildGuestDeclinedHtml(emailContent.guest_declined, {
              guestName: guest.first_name,
              booking: { check_in: booking.check_in, check_out: booking.check_out },
            }),
          });
        } catch (err) {
          console.error('Failed to send decline email:', err);
        }
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
