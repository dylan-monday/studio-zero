import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
// ---------------------------------------------------------------------------
// Inlined from _lib/email-templates.ts (Vercel can't resolve cross-dir imports)
// ---------------------------------------------------------------------------

interface CheckinContent {
  subject: string;
  address: string;
  city_state_zip: string;
  address_note: string;
  maps_url: string;
  entry_steps: Array<{ label: string; detail: string }>;
  key_warning: string;
  lost_key_fee: string;
  wifi_network: string;
  wifi_password: string;
  tips: string[];
  checkout_reminders: string[];
  emergency_name: string;
  emergency_role: string;
  emergency_email: string;
  emergency_phone: string;
}

const DEFAULT_CHECKIN_CONTENT: CheckinContent = {
  subject: 'Check-in tomorrow: everything you need',
  address: '3520 18th Street',
  city_state_zip: 'San Francisco, CA 94110',
  address_note: "We're at the corner of 18th & Valencia.",
  maps_url: 'https://maps.google.com/?q=3520+18th+Street+San+Francisco+CA+94110',
  entry_steps: [
    { label: 'Lockbox', detail: 'Located on the exterior of the building. Code: 6972' },
    { label: 'Building entry', detail: 'Use the key from the lockbox to enter the gate' },
    { label: 'Find the studio', detail: 'Ground floor, look for the door with the "0" plaque' },
    { label: 'Studio door code', detail: '8432' },
  ],
  key_warning: 'Always return the key to the lockbox when you leave — even for short trips. This prevents lost keys and ensures you won\'t get locked out.',
  lost_key_fee: '$50 fee applies if keys are not in the lockbox at checkout.',
  wifi_network: 'StudioZero',
  wifi_password: 'zerozerozero',
  tips: [
    'Extra towels are in the storage bench',
    'Heater is available — please turn off before leaving',
    'Garden and laundry (washer/dryer) are in the backyard',
    'Please be quiet in shared spaces — this is a residential building',
  ],
  checkout_reminders: [
    'Check-out by 11:00 AM',
    'Return keys to the lockbox',
    'Turn off the heater',
    'Take any trash with you',
  ],
  emergency_name: 'Steve',
  emergency_role: 'Property Manager',
  emergency_email: 'steve@morleyfredericks.com',
  emergency_phone: '(415) 806-5455',
};

async function fetchEmailContent(supabase: any): Promise<{ checkin: CheckinContent }> {
  const { data } = await supabase.from('settings').select('key, value').in('key', ['email_content_checkin']);

  const stored: Record<string, unknown> = {};
  if (data) {
    for (const row of data) {
      stored[row.key] = row.value;
    }
  }

  return {
    checkin: { ...DEFAULT_CHECKIN_CONTENT, ...(stored['email_content_checkin'] as object || {}) },
  };
}

// Styling helpers

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

// Email builder: Check-in Instructions

function buildCheckinInstructionsHtml(
  content: CheckinContent,
  data: { guestName: string; booking: { check_in: string; check_out: string } },
): string {
  const entryStepsHtml = content.entry_steps
    .map((step, i) => `
      <tr>
        <td style="padding: 8px 12px 8px 0; color: #1c1917; font-size: 14px; vertical-align: top; font-weight: 500; white-space: nowrap;">${i + 1}. ${step.label}:</td>
        <td style="padding: 8px 0; color: #1c1917; font-size: 14px; vertical-align: top;">${step.detail}</td>
      </tr>`)
    .join('');

  const tipsHtml = content.tips
    .map(t => `<li style="padding: 4px 0; color: #78716c; font-size: 14px; line-height: 1.5;">${t}</li>`)
    .join('');

  const checkoutHtml = content.checkout_reminders
    .map(r => `<li style="padding: 4px 0; color: #78716c; font-size: 14px; line-height: 1.5;">${r}</li>`)
    .join('');

  return emailWrapper(`
    <div style="margin-bottom: 32px;">
      ${sectionLabel('Check-in')}
      ${heading(`Hi ${data.guestName},`)}
    </div>
    ${bodyText("You're checking in tomorrow! Here's everything you need.")}

    ${sectionStart('Address')}
      <p style="color: #1c1917; font-size: 16px; font-weight: 500; margin: 0 0 4px 0;">${content.address}</p>
      <p style="color: #78716c; font-size: 14px; margin: 0 0 8px 0;">${content.city_state_zip}</p>
      <p style="color: #78716c; font-size: 14px; margin: 0 0 16px 0;">${content.address_note}</p>
      <a href="${content.maps_url}" style="color: #1c1917; font-size: 14px; font-weight: 500; text-decoration: underline;">Open in Google Maps &rarr;</a>
    </div>

    ${sectionStart('Entry \u2014 Please Read Carefully')}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        ${entryStepsHtml}
      </table>
      <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 16px; margin-bottom: 8px;">
        <p style="color: #92400e; font-size: 14px; line-height: 1.5; margin: 0; font-weight: 500;">&#9888;&#65039; ${content.key_warning}</p>
      </div>
      <p style="color: #92400e; font-size: 13px; font-weight: 500; margin: 8px 0 0 0;">${content.lost_key_fee}</p>
    </div>

    ${sectionStart('WiFi')}
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 4px 16px 4px 0; color: #78716c; font-size: 14px;">Network:</td><td style="padding: 4px 0; color: #1c1917; font-size: 14px; font-weight: 500;">${content.wifi_network}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #78716c; font-size: 14px;">Password:</td><td style="padding: 4px 0; color: #1c1917; font-size: 14px; font-weight: 500;">${content.wifi_password}</td></tr>
      </table>
    </div>

    ${sectionStart('While You\'re Here')}
      <ul style="margin: 0; padding-left: 20px;">${tipsHtml}</ul>
    </div>

    ${sectionStart('Checkout')}
      <ul style="margin: 0; padding-left: 20px;">${checkoutHtml}</ul>
    </div>

    ${sectionStart('Need Help?')}
      <p style="color: #78716c; font-size: 14px; margin: 0 0 4px 0;">${content.emergency_role} (${content.emergency_name}): <a href="mailto:${content.emergency_email}" style="color: #1c1917;">${content.emergency_email}</a> / ${content.emergency_phone}</p>
    </div>

    <p style="color: #78716c; font-size: 15px; line-height: 1.65; margin: 28px 0;">Have a great stay!</p>
    ${footer()}
  `);
}

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
