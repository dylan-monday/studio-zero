import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import { createHmac, timingSafeEqual } from 'crypto';
// ---------------------------------------------------------------------------
// Types (inlined from _lib/email-templates to fix Vercel resolution)
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

interface AllEmailContent {
  guest_pending: GuestPendingContent;
  owner_approval: OwnerApprovalContent;
  guest_confirmed: GuestConfirmedContent;
  guest_declined: GuestDeclinedContent;
  checkin: CheckinContent;
}

// ---------------------------------------------------------------------------
// Defaults (from studio-zero-sf-copy.md)
// ---------------------------------------------------------------------------

const DEFAULT_EMAIL_CONTENT: AllEmailContent = {
  guest_pending: {
    subject: 'We got your request for Studio Zero',
    body: "Thanks for booking Studio Zero! We've received your request. We'll confirm your reservation within 24 hours. You'll get another email as soon as we do.",
    footer: 'If you have any questions in the meantime, just reply to this email.',
  },
  owner_approval: {
    subject_template: 'New booking request: {guest_name}, {check_in}',
    auth_note: 'Card has been authorized but not charged. Approving will capture the payment. Declining will release the hold.',
    approve_label: 'Approve',
    decline_label: 'Decline',
  },
  guest_confirmed: {
    subject: "You're confirmed at Studio Zero",
    body: "Great news — your reservation is confirmed.",
    whats_next: "We'll send you the full address and entry instructions the day before your arrival.",
    footer: 'Questions before then? Just reply to this email.',
  },
  guest_declined: {
    subject: 'Update on your Studio Zero request',
    body: "Unfortunately, we're not able to confirm your reservation for {dates}. Your payment has been fully refunded — you should see it back in your account within 5–10 business days, depending on your bank.",
    secondary: 'If your dates are flexible, feel free to check availability and try again.',
    cta_text: 'Check Availability',
  },
  checkin: {
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
  },
};

// Settings key mapping
const SETTINGS_KEYS: Record<keyof AllEmailContent, string> = {
  guest_pending: 'email_content_guest_pending',
  owner_approval: 'email_content_owner_approval',
  guest_confirmed: 'email_content_guest_confirmed',
  guest_declined: 'email_content_guest_declined',
  checkin: 'email_content_checkin',
};

// ---------------------------------------------------------------------------
// Fetch content from settings, merging with defaults
// ---------------------------------------------------------------------------

async function fetchEmailContent(supabase: any): Promise<AllEmailContent> {
  const keys = Object.values(SETTINGS_KEYS);
  const { data } = await supabase.from('settings').select('key, value').in('key', keys);

  const stored: Record<string, unknown> = {};
  if (data) {
    for (const row of data) {
      stored[row.key] = row.value;
    }
  }

  return {
    guest_pending: { ...DEFAULT_EMAIL_CONTENT.guest_pending, ...(stored[SETTINGS_KEYS.guest_pending] as object || {}) },
    owner_approval: { ...DEFAULT_EMAIL_CONTENT.owner_approval, ...(stored[SETTINGS_KEYS.owner_approval] as object || {}) },
    guest_confirmed: { ...DEFAULT_EMAIL_CONTENT.guest_confirmed, ...(stored[SETTINGS_KEYS.guest_confirmed] as object || {}) },
    guest_declined: { ...DEFAULT_EMAIL_CONTENT.guest_declined, ...(stored[SETTINGS_KEYS.guest_declined] as object || {}) },
    checkin: { ...DEFAULT_EMAIL_CONTENT.checkin, ...(stored[SETTINGS_KEYS.checkin] as object || {}) },
  };
}

// ---------------------------------------------------------------------------
// Shared styling helpers
// ---------------------------------------------------------------------------

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

function emailFooter(): string {
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

// ---------------------------------------------------------------------------
// Email builder: Guest Pending
// ---------------------------------------------------------------------------

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
    ${emailFooter()}
  `);
}

// ---------------------------------------------------------------------------
// Email builder: Owner Approval
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Email builder: Guest Confirmed
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Email builder: Guest Declined
// ---------------------------------------------------------------------------

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
    ${emailFooter()}
  `);
}

// ---------------------------------------------------------------------------
// Email builder: Check-in Instructions
// ---------------------------------------------------------------------------

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
    ${emailFooter()}
  `);
}

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
