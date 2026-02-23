# Studio Zero SF — Project Specification

## Overview

A custom direct-booking platform for a single studio apartment in San Francisco. Replaces Lodgify with a lean, beautiful, purpose-built solution.

**Domain:** studiozerosf.com  
**Owner:** Dylan  
**Development approach:** Claude Code as primary developer  

---

## Goals

1. Accept direct bookings with Stripe payment processing
2. Owner approval workflow before confirming reservations
3. Guest accounts with booking history and saved details
4. Clean, minimal UI that showcases the space
5. Simple admin for managing rates, photos, coupons, and bookings
6. Automated email communications throughout the guest journey

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18 + Vite | Fast builds, modern DX |
| Styling | Tailwind CSS | Rapid UI development, consistent design |
| Backend/DB | Supabase | Auth, PostgreSQL, Storage, Edge Functions, Row Level Security |
| Payments | Stripe | Checkout Sessions, Webhooks, Refunds API |
| Email | Resend | Developer-friendly, React Email templates |
| SMS (Phase 2) | Twilio | Optional notifications |
| Hosting | Vercel | Seamless React deployment, edge functions, domain management |
| Calendar | react-day-picker or similar | Date selection UI |

---

## Database Schema (Supabase/PostgreSQL)

### `guests`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           TEXT UNIQUE NOT NULL
first_name      TEXT NOT NULL
last_name       TEXT NOT NULL
phone           TEXT
address_line1   TEXT
address_city    TEXT
address_state   TEXT
address_zip     TEXT
address_country TEXT DEFAULT 'US'
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

### `bookings`
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
guest_id            UUID REFERENCES guests(id)
check_in            DATE NOT NULL
check_out           DATE NOT NULL
nights              INT GENERATED ALWAYS AS (check_out - check_in) STORED
guests_count        INT DEFAULT 1
status              TEXT DEFAULT 'pending' 
                    -- pending, approved, confirmed, cancelled, completed
nightly_rate        DECIMAL(10,2) NOT NULL
subtotal            DECIMAL(10,2) NOT NULL
discount_amount     DECIMAL(10,2) DEFAULT 0
cleaning_fee        DECIMAL(10,2) DEFAULT 0
total_amount        DECIMAL(10,2) NOT NULL
amount_paid         DECIMAL(10,2) DEFAULT 0
stripe_checkout_id  TEXT
stripe_payment_intent TEXT
coupon_id           UUID REFERENCES coupons(id)
guest_notes         TEXT
admin_notes         TEXT
approval_token      TEXT UNIQUE
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```

### `blocked_dates`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
date        DATE NOT NULL UNIQUE
reason      TEXT -- 'owner_block', 'maintenance', etc.
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### `pricing_rules`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
rule_type       TEXT NOT NULL 
                -- 'base', 'weekend', 'weekday', 'date_override', 'seasonal'
priority        INT DEFAULT 0  -- higher priority wins; date_override = 100, seasonal = 50, weekend/weekday = 10, base = 0
nightly_rate    DECIMAL(10,2) NOT NULL
start_date      DATE  -- for seasonal or date_override ranges
end_date        DATE  -- for seasonal or date_override ranges
days_of_week    INT[] -- 0=Sun, 1=Mon... 6=Sat (for weekend: [5,6], weekday: [0,1,2,3,4])
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `date_overrides`
```sql
-- Simple table for single-date price overrides (easiest for bulk editing)
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
date            DATE NOT NULL UNIQUE
nightly_rate    DECIMAL(10,2) NOT NULL
note            TEXT  -- "Fleet Week", "Dreamforce", etc.
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `coupons`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            TEXT UNIQUE NOT NULL
discount_type   TEXT NOT NULL -- 'percentage', 'fixed'
discount_value  DECIMAL(10,2) NOT NULL
min_nights      INT DEFAULT 1
max_uses        INT
current_uses    INT DEFAULT 0
valid_from      DATE
valid_until     DATE
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `photos`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
storage_path    TEXT NOT NULL
url             TEXT NOT NULL
caption         TEXT
alt_text        TEXT
display_order   INT DEFAULT 0
is_hero         BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### `settings`
```sql
key             TEXT PRIMARY KEY
value           JSONB NOT NULL
updated_at      TIMESTAMPTZ DEFAULT NOW()
```
Settings will store: cleaning_fee, max_guests, check_in_time, check_out_time, house_rules (array), cancellation_policy, contact_email, contact_phone, property_description, neighborhood_info, etc.

### `email_log`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
booking_id      UUID REFERENCES bookings(id)
email_type      TEXT NOT NULL
recipient       TEXT NOT NULL
sent_at         TIMESTAMPTZ DEFAULT NOW()
resend_id       TEXT
```

---

## User Roles & Authentication

### Guest
- Sign up / sign in via email magic link (Supabase Auth)
- No password required — frictionless
- Can view their booking history
- Can request modifications to upcoming bookings
- Profile auto-populates on repeat bookings

### Owner/Admin
- Email + password auth (single admin account)
- Full dashboard access
- Identified by `admin` role in Supabase user metadata

---

## Pages & Routes

### Public (Guest-Facing)

| Route | Description |
|-------|-------------|
| `/` | Landing page: hero image, photo gallery, property description, neighborhood, house rules summary, booking CTA |
| `/book` | Booking flow: calendar, guest count, pricing breakdown, coupon input, guest details form, Stripe checkout |
| `/book/success` | Post-payment confirmation, "awaiting approval" message |
| `/booking/:id` | Guest booking detail view (requires auth or magic token) |
| `/booking/:id/modify` | Request changes: add nights, change dates, cancel |
| `/login` | Magic link login for guests |
| `/account` | Guest account: profile, booking history |
| `/house-rules` | Full house rules page |
| `/faq` | Frequently asked questions |

### Admin Dashboard

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard overview: upcoming bookings, pending approvals, quick stats |
| `/admin/bookings` | All bookings list with filters (status, date range) |
| `/admin/bookings/:id` | Booking detail: approve/deny, add notes, issue refund, view guest history |
| `/admin/calendar` | Visual calendar with bookings and blocked dates |
| `/admin/pricing` | Manage base rate, weekend rates, seasonal pricing, minimum nights |
| `/admin/coupons` | Create/edit/deactivate coupons |
| `/admin/photos` | Upload, reorder, caption, delete photos |
| `/admin/settings` | Property details, house rules, check-in instructions, cancellation policy |
| `/admin/guests` | Guest directory with booking history |

---

## Core Workflows

### Booking Flow

```
Guest selects dates
    ↓
System calculates pricing (applies rules, coupons)
    ↓
Guest enters details (or auto-fills if returning)
    ↓
Guest redirected to Stripe Checkout
    ↓
Stripe webhook: payment successful
    ↓
Booking created with status: 'pending'
    ↓
Email to owner: "New booking request" with approve/deny links
Email to guest: "Booking received, awaiting confirmation"
    ↓
Owner clicks approve link (or approves in dashboard)
    ↓
Booking status: 'approved' → 'confirmed'
    ↓
Email to guest: "Booking confirmed!" with details
    ↓
24 hours before check-in: automated check-in instructions email
    ↓
Day after check-out: "Thanks for staying" email
```

### Owner Approval via Email

- Email contains two links with secure tokens:
  - `https://studiozerosf.com/admin/approve/:token`
  - `https://studiozerosf.com/admin/deny/:token`
- Clicking approve: updates booking status, triggers confirmation email
- Clicking deny: updates status to 'cancelled', triggers refund, sends guest cancellation email
- Links expire after 72 hours (fallback to dashboard)

### Cancellation & Refunds

**Policy (displayed during booking):**
- 30+ days before check-in: Full refund minus 3% processing fee
- 14-29 days before check-in: 50% refund
- Under 14 days: No refund

**Guest-initiated cancellation:**
1. Guest visits `/booking/:id/modify`
2. Clicks "Cancel Reservation"
3. System shows refund amount based on policy
4. Guest confirms
5. Stripe refund issued automatically
6. Booking status → 'cancelled'
7. Emails sent to guest and owner

**Owner-initiated cancellation:**
1. From dashboard, select booking → Cancel
2. Choose refund amount (can override policy)
3. Stripe refund issued
4. Guest notified with apology email

### Guest Modification Requests

1. Guest visits `/booking/:id/modify`
2. Options: "Add nights", "Change dates", "Cancel"
3. Modifications create a `modification_request` (or we handle inline)
4. Owner notified, can approve/deny
5. If price changes, guest pays difference or receives partial refund

---

## Pricing Engine

```javascript
function calculatePrice(checkIn, checkOut, coupon = null) {
  const nights = [];
  let current = checkIn;
  
  while (current < checkOut) {
    const applicableRules = getPricingRules(current);
    const rate = getHighestPriorityRate(applicableRules);
    nights.push({ date: current, rate });
    current = addDays(current, 1);
  }
  
  const subtotal = nights.reduce((sum, n) => sum + n.rate, 0);
  const cleaningFee = getSettings('cleaning_fee');
  let discount = 0;
  
  if (coupon && isValidCoupon(coupon, nights.length)) {
    discount = coupon.discount_type === 'percentage' 
      ? subtotal * (coupon.discount_value / 100)
      : coupon.discount_value;
  }
  
  return {
    nights,
    subtotal,
    cleaningFee,
    discount,
    total: subtotal + cleaningFee - discount
  };
}
```

---

## Email Templates (Resend + React Email)

| Trigger | Recipient | Template |
|---------|-----------|----------|
| Payment received | Guest | `booking-pending.tsx` — "We've received your request" |
| Payment received | Owner | `owner-new-booking.tsx` — Approve/deny links, guest details |
| Booking approved | Guest | `booking-confirmed.tsx` — Dates, address, check-in time |
| Booking denied | Guest | `booking-denied.tsx` — Apology, refund info |
| 24h before check-in | Guest | `checkin-instructions.tsx` — Door code, WiFi, parking |
| Day after check-out | Guest | `post-stay.tsx` — Thank you, invite to book again |
| Cancellation | Guest | `booking-cancelled.tsx` — Refund details |
| Cancellation | Owner | `owner-cancellation.tsx` — Notification |
| Modification request | Owner | `modification-request.tsx` — Approve/deny links |
| Modification approved | Guest | `modification-approved.tsx` — Updated details |

---

## Admin Dashboard Components

### Overview (`/admin`)
- Stat cards: bookings this month, revenue this month, occupancy rate
- Pending approvals (action required)
- Upcoming check-ins (next 7 days)
- Recent bookings

### Booking Detail (`/admin/bookings/:id`)
- Guest info (with link to full guest profile)
- Dates, nights, pricing breakdown
- Status badge with actions (approve, deny, cancel, mark complete)
- Payment status (paid, refunded, partial)
- Admin notes field
- Activity log (status changes, emails sent)
- "View as guest" link

### Calendar (`/admin/calendar`)
- Month view with bookings displayed
- Click to view booking
- Click empty date to block
- Color coding: confirmed (green), pending (yellow), blocked (gray)

### Photo Manager (`/admin/photos`)
- Drag-and-drop upload
- Drag to reorder
- Inline caption editing
- Set hero image (first on landing page)
- Delete with confirmation

---

## API Routes (Supabase Edge Functions)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/availability` | GET | Returns available dates for next N months |
| `/api/pricing` | POST | Calculate price for date range |
| `/api/booking/create` | POST | Create Stripe Checkout session |
| `/api/booking/approve/:token` | GET | Approve booking via email link |
| `/api/booking/deny/:token` | GET | Deny booking via email link |
| `/api/booking/:id/cancel` | POST | Process cancellation and refund |
| `/api/booking/:id/modify` | POST | Handle modification request |
| `/api/webhook/stripe` | POST | Stripe webhook handler |
| `/api/coupons/validate` | POST | Check if coupon is valid |
| `/api/admin/photos/upload` | POST | Upload photo to Supabase Storage |
| `/api/cron/checkin-reminders` | POST | Send check-in emails (Vercel Cron) |

---

## Stripe Integration

### Checkout Session Creation
```javascript
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  customer_email: guest.email,
  line_items: [{
    price_data: {
      currency: 'usd',
      product_data: {
        name: `Studio Zero SF — ${nights} nights`,
        description: `${formatDate(checkIn)} to ${formatDate(checkOut)}`,
      },
      unit_amount: totalInCents,
    },
    quantity: 1,
  }],
  metadata: {
    check_in: checkIn,
    check_out: checkOut,
    guest_id: guest.id,
    coupon_code: coupon?.code,
  },
  success_url: `${baseUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/book?cancelled=true`,
});
```

### Webhook Events to Handle
- `checkout.session.completed` — Create booking, send emails
- `charge.refunded` — Update booking payment status

---

## Environment Variables

```
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
VITE_STRIPE_PUBLISHABLE_KEY=

# Resend
RESEND_API_KEY=

# App
VITE_APP_URL=https://studiozerosf.com
ADMIN_EMAIL=dylan@...
```

---

## Security Considerations

1. **Row Level Security (RLS)** on all Supabase tables
   - Guests can only read their own bookings
   - Admin can read/write all
   - Public can read photos, settings (non-sensitive)

2. **Approval tokens** — UUID v4, single-use, expire after 72h

3. **Stripe webhook signature verification** — Always validate

4. **Admin routes protected** — Check user role before rendering

5. **Rate limiting** — On booking creation, coupon validation

---

## Development Phases

### Phase 1: Foundation (MVP)
- [ ] Project setup: Vite + React + Tailwind + Supabase
- [ ] Database schema + RLS policies
- [ ] Landing page with static content
- [ ] Photo gallery component
- [ ] Availability calendar (read-only)
- [ ] Booking flow UI
- [ ] Stripe Checkout integration
- [ ] Webhook handler (booking creation)
- [ ] Basic email templates (pending, confirmed)
- [ ] Owner approval via email links
- [ ] Deploy to Vercel, connect domain

### Phase 2: Admin Dashboard
- [ ] Admin auth + protected routes
- [ ] Dashboard overview
- [ ] Bookings list + detail view
- [ ] Calendar view
- [ ] Manual booking approval/denial
- [ ] Pricing rules management
- [ ] Settings management

### Phase 3: Guest Experience
- [ ] Guest auth (magic link)
- [ ] Guest account page
- [ ] Booking history
- [ ] Auto-fill returning guest details
- [ ] Booking detail view for guests
- [ ] Modification requests
- [ ] Cancellation flow with refunds

### Phase 4: Polish
- [ ] Photo management in admin
- [ ] Coupon system
- [ ] All email templates
- [ ] Check-in reminder cron job
- [ ] FAQ page
- [ ] Mobile responsiveness audit
- [ ] Error handling + loading states
- [ ] Analytics (simple occupancy/revenue)

### Phase 5: Optional Enhancements
- [ ] SMS notifications via Twilio
- [ ] iCal feed export
- [ ] Longer stay auto-discounts
- [ ] Review/testimonial system

---

## File Structure

```
studio-zero-sf/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ui/                 # Buttons, inputs, cards, etc.
│   │   ├── layout/             # Header, footer, containers
│   │   ├── booking/            # Calendar, pricing, checkout
│   │   ├── gallery/            # Photo grid, lightbox
│   │   └── admin/              # Dashboard components
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Book.tsx
│   │   ├── BookingSuccess.tsx
│   │   ├── BookingDetail.tsx
│   │   ├── Login.tsx
│   │   ├── Account.tsx
│   │   ├── HouseRules.tsx
│   │   ├── FAQ.tsx
│   │   └── admin/
│   │       ├── Dashboard.tsx
│   │       ├── Bookings.tsx
│   │       ├── BookingDetail.tsx
│   │       ├── Calendar.tsx
│   │       ├── Pricing.tsx
│   │       ├── Coupons.tsx
│   │       ├── Photos.tsx
│   │       ├── Settings.tsx
│   │       └── Guests.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Client initialization
│   │   ├── stripe.ts           # Stripe helpers
│   │   ├── pricing.ts          # Pricing calculation
│   │   ├── dates.ts            # Date utilities
│   │   └── email.ts            # Email sending helpers
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBookings.ts
│   │   ├── useAvailability.ts
│   │   └── useAdmin.ts
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── migrations/             # SQL migrations
│   └── functions/              # Edge functions
│       ├── create-checkout/
│       ├── stripe-webhook/
│       ├── approve-booking/
│       ├── deny-booking/
│       └── send-email/
├── emails/                     # React Email templates
│   ├── booking-pending.tsx
│   ├── booking-confirmed.tsx
│   ├── owner-new-booking.tsx
│   └── ...
├── .env.local
├── .env.example
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## Design Notes

**Aesthetic:** Clean, minimal, modern. Think Airbnb meets Linear. Lots of whitespace, beautiful photography front and center, subtle animations.

**Typography:** System font stack or a clean sans-serif (Inter, DM Sans)

**Colors:** 
- Primary: Deep charcoal or navy
- Accent: Warm terracotta or sage green (SF vibes)
- Background: Off-white / light warm gray
- Success/Error: Standard green/red

**Key UI Principles:**
- Mobile-first
- Large touch targets
- Clear CTAs
- Progressive disclosure (don't overwhelm)
- Instant feedback on actions

---

## Claude Code Instructions

When working on this project:

1. **Start with Phase 1** — Get the core booking flow working end-to-end before adding features
2. **Test Stripe in test mode** — Use test API keys and test card numbers
3. **Seed data** — Create sample pricing rules, a test coupon, placeholder photos
4. **Commit often** — Small, focused commits with clear messages
5. **Environment variables** — Never commit secrets; use `.env.local`
6. **TypeScript strict mode** — Catch errors early
7. **Mobile testing** — Check responsive layouts frequently

---

## Property Details

| Setting | Value |
|---------|-------|
| Cleaning fee | $50 |
| Base nightly rate | $165 |
| Minimum nights | 2 |
| Maximum guests | 2 |
| Check-in time | 3:00 PM |
| Check-out time | 11:00 AM |

### Pricing Flexibility Required

The admin needs robust pricing controls:

1. **Base rate:** $165/night (default)
2. **Day-of-week pricing:** Set different rates for weekdays vs weekends (Fri/Sat typically higher)
3. **Date-specific overrides:** Set custom rate for any specific date (holidays, events, Fleet Week, Dreamforce, etc.)
4. **Bulk editing:** Select a date range and apply a rate to all dates within it
5. **Seasonal patterns:** Optional — set recurring seasonal adjustments (e.g., summer premium)

**Admin UI for pricing:**
- Calendar view where each date shows its current rate
- Click a date to edit that single day
- Click and drag to select a range, then bulk-set rate
- Toggle to show "weekday rate" / "weekend rate" defaults
- Visual indicators for dates with custom overrides

---

## Design Direction

### Guiding Principles

**Light.** White and near-white backgrounds. Airy. Let the photos do the work.

**Positive.** Friendly without being cutesy. Welcoming. The copy should feel like a good host.

**Simple.** No clutter. One clear action per screen. If someone's confused, we've failed.

**Clear.** Big readable type. Obvious buttons. No hunting for information.

### Color Palette

```
Background:       #FFFFFF (white)
Surface:          #FAFAFA (barely gray, for cards/sections)
Border:           #E5E5E5 (subtle dividers)
Text Primary:     #1A1A1A (near-black, high contrast)
Text Secondary:   #6B7280 (gray-500, for supporting text)
Accent:           #2563EB (blue-600, trustworthy, clear CTAs)
Accent Hover:     #1D4ED8 (blue-700)
Success:          #059669 (emerald-600)
Warning:          #D97706 (amber-600)
Error:            #DC2626 (red-600)
```

**Why blue accent?** It's universally trusted (think "Book Now" buttons everywhere), highly accessible, and won't fight with the photography. It's a "get out of the way" color that just works.

### Typography

**Font:** Inter (clean, highly legible, great at all sizes)

```
Headings:    font-semibold
H1:          text-3xl md:text-4xl
H2:          text-2xl md:text-3xl  
H3:          text-xl
Body:        text-base (16px)
Small:       text-sm (14px)
```

### Component Style

- **Buttons:** Rounded corners (rounded-lg), solid fill for primary actions, outline for secondary
- **Cards:** Subtle border or very light shadow, rounded-xl
- **Inputs:** Clean borders, generous padding, clear focus states
- **Calendar:** Large tap targets, clear selected/unavailable states
- **Photos:** Full-bleed where possible, subtle rounded corners

### Layout

- **Max content width:** 1200px (centered)
- **Generous whitespace:** Don't crowd elements
- **Mobile-first:** Touch-friendly, thumb-zone aware
- **Sticky booking bar:** On property page, always show dates/price/CTA at bottom on mobile

### Micro-interactions

- Subtle hover states
- Smooth transitions (150-200ms)
- Loading spinners for async actions
- Success checkmarks after bookings
- No jarring movements

---

## House Rules (To Be Refined)

*Dylan to provide current rules. Below is a suggested structure for clear, friendly rules:*

### The Basics
- Check-in: 3:00 PM / Check-out: 11:00 AM
- Maximum 2 guests
- No smoking (inside or on balcony)
- No parties or events
- No pets (unfortunately — allergies)

### Keeping the Peace
- Quiet hours: 10 PM – 8 AM
- Be mindful of neighbors in the hallway
- Keep music/TV at reasonable levels

### The Space
- Shoes off inside, please
- No candles or incense (fire safety)
- Report any damage or issues immediately — we won't be upset, things happen

### Kitchen
- Feel free to use all appliances and cookware
- Please wash dishes before checkout (or load dishwasher)
- Take any perishables with you

### Parking & Entry
- [Details on parking situation]
- [Entry/lockbox/smart lock instructions]

### WiFi
- Network: [TBD]
- Password: [TBD]

### Getting Help
- For urgent issues: [Phone number]
- For questions: [Email]
- Local emergencies: 911

---

*Spec version: 1.1*  
*Last updated: February 2025*
