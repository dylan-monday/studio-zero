# Studio Zero SF - Claude Context

## Project Overview

Studio Zero SF is a custom direct-booking platform for a single studio apartment in San Francisco. It replaces Lodgify with a lean, purpose-built solution featuring Stripe payments (authorization hold), owner approval workflows, and automated guest communications via SendGrid.

**Domain:** studiozerosf.com
**Owner:** Dylan
**Tech Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase + Stripe + SendGrid

## Current State

### Phase 1 - Complete
- Project scaffolding with Vite + React 19 + TypeScript
- Tailwind CSS v4 with elevated design system (DM Serif Display, DM Sans, JetBrains Mono)
- Supabase schema with 8 tables + RLS policies
- Landing page with hero (SF skyline), gallery, amenities, house rules, calendar
- Booking flow UI (3-step: dates, details, review)
- Pricing calculation engine with rule priorities
- Availability helper combining blocked_dates + bookings
- Local property photos in `public/photos/`
- Stripe Checkout with **authorization hold** (`capture_method: 'manual'`)
- Stripe webhook handler (creates booking, sends emails via SendGrid)
- Owner approval workflow (approve captures payment, decline releases hold)
- SendGrid email templates (guest pending, guest confirmed, guest declined, owner approval)
- Success page after booking (reflects auth hold messaging)
- Admin result page for approval feedback
- Admin bookings list page at `/admin` (via service role API)
- Vercel SPA routing (vercel.json)
- Cloudflare email routing: info@studiozerosf.com → dylan@dylandibona.com
- SendGrid domain authentication verified for studiozerosf.com
- Copy deck (COPY-DECK.md) for Dylan to review/edit all site copy

### Phase 2 - In Progress
- **Admin booking detail view** — click into reservations to update/cancel/email guests
- **Admin coupon management** — CRUD for discount codes
- **Admin date blocking** — block dates, set rates
- **House rules page** — waiting on content from Dylan (see COPY-DECK.md)

### Phase 2 - Not Yet Built
- Guest authentication (magic links for viewing/managing bookings)
- Check-in instructions email (auto-send 24h before arrival)
- iCal export for calendar sync
- Admin email copy management (lockbox codes, etc.)

## Key Files

### Core Application
- `src/App.tsx` - Router with all routes
- `src/pages/Home.tsx` - Landing page
- `src/pages/Book.tsx` - 3-step booking flow with Stripe integration
- `src/pages/BookingSuccess.tsx` - Post-payment success page (auth hold messaging)
- `src/pages/AdminResult.tsx` - Owner approval feedback page
- `src/pages/Admin.tsx` - Admin bookings list with filters

### API Routes (Vercel Serverless)
- `api/create-checkout-session.ts` - Creates Stripe Checkout session (capture_method: manual)
- `api/webhooks/stripe.ts` - Handles Stripe webhooks (creates booking with amount_paid: 0, sends emails)
- `api/booking/details.ts` - Fetches booking details from session ID
- `api/booking/approve.ts` - Owner approve (captures payment) / decline (cancels hold)
- `api/admin/bookings.ts` - Admin endpoint using service role key (bypasses RLS)

### Pricing & Availability
- `src/lib/pricing.ts` - Price calculation with rule priorities
- `src/lib/availability.ts` - Date availability checking
- `src/hooks/useAvailability.ts` - React hook for calendar data

### Components
- `src/components/ui/Button.tsx` - Primary/secondary/outline/ghost variants
- `src/components/ui/Container.tsx` - Responsive max-width wrapper
- `src/components/layout/{Header,Footer,Layout}.tsx`
- `src/components/booking/AvailabilityCalendar.tsx`
- `src/components/gallery/PhotoGallery.tsx`

### Database
- `supabase/migrations/001_initial_schema.sql` - All tables + seed data
- `supabase/migrations/002_row_level_security.sql` - RLS policies
- `supabase/migrations/003_coupon_increment_function.sql` - Coupon usage function

### Types
- `src/types/index.ts` - All TypeScript interfaces

### Content
- `COPY-DECK.md` - Complete copy deck for all user-facing text (for Dylan to edit)
- `vercel.json` - SPA routing rewrites

## Payment Flow

1. Guest selects dates → Stripe Checkout with `capture_method: 'manual'`
2. Card is **authorized** (not charged) → webhook creates booking with `amount_paid: 0`
3. Guest gets "card authorized" email, owner gets approval request email
4. Owner clicks **Approve** → `paymentIntents.capture()` → `amount_paid` updated → guest gets confirmation email
5. Owner clicks **Decline** → `paymentIntents.cancel()` → hold released → guest gets decline email

## Design System

**Colors** (CSS variables in `src/index.css`):
- Background: `#faf9f7` (warm off-white)
- Surface: `#f5f4f0`
- Border: `#e2dfd9`
- Text Primary: `#1c1917` (warm black)
- Text Secondary: `#78716c` (warm gray)
- Accent: `#1c1917` (text-primary used as accent)
- Success/Warning/Error: emerald-600/amber-600/red-600

**Typography:**
- Headings: DM Serif Display (serif)
- Body: DM Sans
- Labels/Mono: JetBrains Mono (uppercase tracking)
- Pattern: `font-mono text-xs uppercase tracking-[0.2em]` for section labels
- Pattern: `font-serif text-3xl md:text-4xl tracking-tight` for page headings

**Patterns:**
- Mobile-first responsive design
- Components use Tailwind utility classes
- Use existing Button/Container components
- date-fns for all date operations

## Database Schema

| Table | Purpose |
|-------|---------|
| `guests` | Guest profiles with contact info |
| `bookings` | Reservations with status workflow (pending → approved → confirmed → completed) |
| `blocked_dates` | Owner blocks, maintenance |
| `pricing_rules` | Base/weekend/seasonal rates |
| `date_overrides` | Single-date price overrides |
| `coupons` | Discount codes |
| `photos` | Property images (currently using static) |
| `settings` | Key-value property config |
| `email_log` | Email tracking |

**Pricing Priority:** date_override (100) > seasonal (50) > weekend/weekday (10) > base (0)

**Booking Status Flow:** pending → approved → confirmed → completed (or cancelled at any point)

## Property Settings

| Setting | Value |
|---------|-------|
| Cleaning fee | $50 |
| Base rate | $165/night |
| Weekend rate | $185/night (Fri/Sat) |
| Min nights | 2 |
| Max guests | 2 |
| Check-in | 3:00 PM |
| Check-out | 11:00 AM |

## Environment Variables

```
# Supabase
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Stripe
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_WEBHOOK_SECRET=<webhook-secret>
VITE_STRIPE_PUBLISHABLE_KEY=<publishable-key>

# SendGrid (email)
SENDGRID_API_KEY=<sendgrid-key>

# App config
VITE_APP_URL=https://studiozerosf.com
OWNER_EMAIL=info@studiozerosf.com
```

## Commands

```bash
npm run dev      # Start dev server
npm run build    # TypeScript check + production build
npm run preview  # Preview production build
```

## Deployment

- **Hosting:** Vercel
- **Database:** Supabase
- **Payments:** Stripe (currently in test mode — switch to live for launch)
- **Email:** SendGrid (trial account — switch to free tier before April 24, 2026)
- **DNS:** Cloudflare
- **Domain:** studiozerosf.com
- **Email routing:** Cloudflare (info@studiozerosf.com → dylan@dylandibona.com)
- **SendGrid domain:** Verified (em5381.studiozerosf.com)

## Admin Notes

- Admin page at `/admin` is not linked in navigation (access directly)
- Admin API endpoint (`/api/admin/bookings`) uses service role key to bypass Supabase RLS
- No admin authentication yet — page is accessible but unlisted
- RLS policies block frontend Supabase client from reading bookings — all admin reads go through API

## Code Conventions

- Use existing component patterns (Button, Container)
- Keep components presentation-only, logic in hooks/lib
- Use `date-fns` for date manipulation
- Format dates as `yyyy-MM-dd` for DB storage
- All pricing in dollars (not cents) until Stripe
- TypeScript strict mode enabled
- Email from address: `info@studiozerosf.com` with name `Studio Zero SF`
- Owner approval emails go to: value of `OWNER_EMAIL` env var (info@studiozerosf.com)
