import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import {
  fetchEmailContent,
  buildCheckinInstructionsHtml,
} from '../_lib/email-templates';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Calculate tomorrow's date in PST (America/Los_Angeles)
    const now = new Date();
    const pstOffset = getPSTOffset(now);
    const pstNow = new Date(now.getTime() + pstOffset * 60 * 1000);
    const tomorrow = new Date(pstNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // yyyy-MM-dd

    console.log(`Checking for bookings with check_in = ${tomorrowStr} (PST)`);

    // Find confirmed bookings checking in tomorrow
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('*, guest:guests(*)')
      .eq('check_in', tomorrowStr)
      .eq('status', 'confirmed');

    if (bErr) {
      console.error('Error fetching bookings:', bErr);
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ message: 'No bookings checking in tomorrow', sent: 0 });
    }

    // Check which bookings already have check-in emails sent
    const bookingIds = bookings.map(b => b.id);
    const { data: existingLogs } = await supabase
      .from('email_log')
      .select('booking_id')
      .in('booking_id', bookingIds)
      .eq('email_type', 'checkin_instructions');

    const alreadySent = new Set((existingLogs || []).map(l => l.booking_id));

    // Filter to bookings that haven't received check-in email yet
    const toSend = bookings.filter(b => !alreadySent.has(b.id) && b.guest);

    if (toSend.length === 0) {
      return res.status(200).json({ message: 'All check-in emails already sent', sent: 0 });
    }

    // Fetch email content
    const emailContent = await fetchEmailContent(supabase);
    const results: Array<{ bookingId: string; guestEmail: string; status: 'sent' | 'failed' }> = [];

    for (const booking of toSend) {
      const guest = booking.guest;
      if (!guest) continue;

      try {
        const html = buildCheckinInstructionsHtml(emailContent.checkin, {
          guestName: guest.first_name,
          booking: { check_in: booking.check_in, check_out: booking.check_out },
        });

        await sgMail.send({
          from: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
          replyTo: { email: 'info@studiozerosf.com', name: 'Studio Zero SF' },
          to: guest.email,
          subject: emailContent.checkin.subject,
          html,
        });

        // Log successful send
        await supabase.from('email_log').insert({
          booking_id: booking.id,
          email_type: 'checkin_instructions',
          recipient: guest.email,
        });

        results.push({ bookingId: booking.id, guestEmail: guest.email, status: 'sent' });
        console.log(`Check-in email sent to ${guest.email} for booking ${booking.id}`);
      } catch (err) {
        console.error(`Failed to send check-in email for booking ${booking.id}:`, err);
        results.push({ bookingId: booking.id, guestEmail: guest.email, status: 'failed' });
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    return res.status(200).json({ message: `Sent ${sentCount} check-in emails`, sent: sentCount, results });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get the UTC offset for PST/PDT in minutes.
 * PST = UTC-8, PDT = UTC-7
 */
function getPSTOffset(date: Date): number {
  // Use Intl to determine if DST is active
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());

  // Create a date string in LA timezone to check offset
  const laTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (laTime.getTime() - utcTime.getTime()) / (60 * 1000);
}
