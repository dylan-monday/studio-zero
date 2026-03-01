import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  fetchEmailContent,
  SETTINGS_KEYS,
  DEFAULT_EMAIL_CONTENT,
  buildGuestPendingHtml,
  buildOwnerApprovalHtml,
  buildGuestConfirmedHtml,
  buildGuestDeclinedHtml,
  buildCheckinInstructionsHtml,
  type AllEmailContent,
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const VALID_TYPES = ['guest_pending', 'owner_approval', 'guest_confirmed', 'guest_declined', 'checkin'] as const;
type EmailType = typeof VALID_TYPES[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;

  // GET — fetch all email content
  if (req.method === 'GET') {
    const content = await fetchEmailContent(supabase);
    return res.status(200).json(content);
  }

  // PATCH — update a specific email type's content
  if (req.method === 'PATCH') {
    const { type, content } = req.body || {};

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Content object required' });
    }

    const settingsKey = SETTINGS_KEYS[type as EmailType];

    // Upsert into settings
    const { error } = await supabase
      .from('settings')
      .upsert({ key: settingsKey, value: content }, { onConflict: 'key' });

    if (error) {
      console.error('Failed to save email content:', error);
      return res.status(500).json({ error: 'Failed to save' });
    }

    return res.status(200).json({ ok: true });
  }

  // POST — test email or send check-in for specific booking
  if (req.method === 'POST') {
    const { action, type, bookingId } = req.body || {};

    if (action === 'test') {
      if (!type || !VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
      }

      const content = await fetchEmailContent(supabase);
      const ownerEmail = process.env.OWNER_EMAIL || 'info@studiozerosf.com';
      const appUrl = process.env.VITE_APP_URL || 'https://studiozerosf.com';

      // Build test HTML based on type
      const testBooking = {
        id: 'test-booking-id',
        check_in: getTestDate(7),
        check_out: getTestDate(9),
        guests_count: 2,
        total_amount: 380,
      };
      const testGuest = 'Test Guest';

      let subject: string;
      let html: string;

      switch (type as EmailType) {
        case 'guest_pending':
          subject = content.guest_pending.subject;
          html = buildGuestPendingHtml(content.guest_pending, { guestName: testGuest, booking: testBooking });
          break;
        case 'owner_approval':
          subject = content.owner_approval.subject_template
            .replace('{guest_name}', testGuest)
            .replace('{check_in}', new Date(testBooking.check_in + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
          html = buildOwnerApprovalHtml(content.owner_approval, {
            booking: testBooking,
            guestName: testGuest,
            guestEmail: 'test@example.com',
            guestPhone: '(555) 123-4567',
            guestNotes: 'This is a test email preview.',
            approveUrl: `${appUrl}/api/booking/approve?token=test&action=approve`,
            declineUrl: `${appUrl}/api/booking/approve?token=test&action=decline`,
          });
          break;
        case 'guest_confirmed':
          subject = content.guest_confirmed.subject;
          html = buildGuestConfirmedHtml(content.guest_confirmed, { guestName: testGuest, booking: testBooking });
          break;
        case 'guest_declined':
          subject = content.guest_declined.subject;
          html = buildGuestDeclinedHtml(content.guest_declined, { guestName: testGuest, booking: testBooking });
          break;
        case 'checkin':
          subject = content.checkin.subject;
          html = buildCheckinInstructionsHtml(content.checkin, { guestName: testGuest, booking: testBooking });
          break;
        default:
          return res.status(400).json({ error: 'Unknown type' });
      }

      try {
        await sgMail.send({
          from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
          replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
          to: ownerEmail,
          subject: `[TEST] ${subject}`,
          html,
        });
        return res.status(200).json({ ok: true, sent_to: ownerEmail });
      } catch (err) {
        console.error('Failed to send test email:', err);
        return res.status(500).json({ error: 'Failed to send test email' });
      }
    }

    if (action === 'send_checkin') {
      if (!bookingId) {
        return res.status(400).json({ error: 'bookingId required' });
      }

      // Fetch booking + guest
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('*, guest:guests(*)')
        .eq('id', bookingId)
        .single();

      if (bErr || !booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (!booking.guest) {
        return res.status(400).json({ error: 'No guest associated with booking' });
      }

      const content = await fetchEmailContent(supabase);
      const html = buildCheckinInstructionsHtml(content.checkin, {
        guestName: booking.guest.first_name,
        booking: { check_in: booking.check_in, check_out: booking.check_out },
      });

      try {
        await sgMail.send({
          from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
          replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
          to: booking.guest.email,
          subject: content.checkin.subject,
          html,
        });

        // Log to email_log
        await supabase.from('email_log').insert({
          booking_id: bookingId,
          email_type: 'checkin_instructions',
          recipient: booking.guest.email,
        });

        return res.status(200).json({ ok: true, sent_to: booking.guest.email });
      } catch (err) {
        console.error('Failed to send check-in email:', err);
        return res.status(500).json({ error: 'Failed to send check-in email' });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

function getTestDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
