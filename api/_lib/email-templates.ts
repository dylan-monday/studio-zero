import { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuestPendingContent {
  subject: string;
  body: string;
  footer: string;
}

export interface OwnerApprovalContent {
  subject_template: string;
  auth_note: string;
  approve_label: string;
  decline_label: string;
}

export interface GuestConfirmedContent {
  subject: string;
  body: string;
  whats_next: string;
  footer: string;
}

export interface GuestDeclinedContent {
  subject: string;
  body: string;
  secondary: string;
  cta_text: string;
}

export interface CheckinContent {
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

export interface AllEmailContent {
  guest_pending: GuestPendingContent;
  owner_approval: OwnerApprovalContent;
  guest_confirmed: GuestConfirmedContent;
  guest_declined: GuestDeclinedContent;
  checkin: CheckinContent;
}

// ---------------------------------------------------------------------------
// Defaults (from studio-zero-sf-copy.md)
// ---------------------------------------------------------------------------

export const DEFAULT_EMAIL_CONTENT: AllEmailContent = {
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

export { SETTINGS_KEYS };

// ---------------------------------------------------------------------------
// Fetch content from settings, merging with defaults
// ---------------------------------------------------------------------------

export async function fetchEmailContent(supabase: SupabaseClient): Promise<AllEmailContent> {
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

export function buildGuestPendingHtml(
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
    ${footer()}
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

export function buildOwnerApprovalHtml(
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

export function buildGuestConfirmedHtml(
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

export function buildGuestDeclinedHtml(
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

// ---------------------------------------------------------------------------
// Email builder: Check-in Instructions
// ---------------------------------------------------------------------------

export function buildCheckinInstructionsHtml(
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
