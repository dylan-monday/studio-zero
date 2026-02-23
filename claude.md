# Studio Zero SF - Claude Context

## Project Overview

Studio Zero SF is a custom direct-booking platform for a single studio apartment in San Francisco. It replaces Lodgify with a lean, purpose-built solution featuring Stripe payments, owner approval workflows, and automated guest communications.

**Domain:** studiozerosf.com
**Owner:** Dylan
**Tech Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Supabase + Stripe

## Current State (Phase 1 - Complete)

### Completed
- Project scaffolding with Vite + React 19 + TypeScript
- Tailwind CSS v4 with custom design system
- Supabase schema with 8 tables + RLS policies
- Landing page with hero, gallery, amenities, house rules, calendar
- Booking flow UI (3-step: dates, details, review)
- Pricing calculation engine with rule priorities
- Availability helper combining blocked_dates + bookings
- Local property photos in `public/photos/`
- Stripe Checkout integration (redirect to hosted checkout)
- Stripe webhook handler for payment processing
- Email templates with Resend (guest pending, guest confirmed, guest declined, owner approval)
- Owner approval workflow (approve/decline via email links with auto-refund)
- Success page after booking
- Admin result page for approval feedback

### Phase 2 (Not Yet Built)
- Admin dashboard (calendar management, bookings list, settings)
- Guest authentication (magic links for viewing/managing bookings)

## Key Files

### Core Application
- `src/App.tsx` - Router with all routes
- `src/pages/Home.tsx` - Landing page
- `src/pages/Book.tsx` - 3-step booking flow with Stripe integration
- `src/pages/BookingSuccess.tsx` - Post-payment success page
- `src/pages/AdminResult.tsx` - Owner approval feedback page

### API Routes (Vercel Serverless)
- `api/create-checkout-session.ts` - Creates Stripe Checkout session
- `api/webhooks/stripe.ts` - Handles Stripe webhooks (creates booking, sends emails)
- `api/booking/details.ts` - Fetches booking details from session ID
- `api/booking/approve.ts` - Owner approve/decline handler (with auto-refund)

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

## Design System

**Colors** (CSS variables in `src/index.css`):
- Background: `#ffffff`
- Surface: `#fafafa`
- Border: `#e5e5e5`
- Text Primary: `#1a1a1a`
- Text Secondary: `#6b7280`
- Accent: `#2563eb` (blue-600)
- Success/Warning/Error: emerald-600/amber-600/red-600

**Typography:** Inter font, semibold headings, 16px body

**Patterns:**
- Mobile-first responsive design
- Components use Tailwind utility classes
- Use existing Button/Container components
- date-fns for all date operations

## Database Schema

| Table | Purpose |
|-------|---------|
| `guests` | Guest profiles with contact info |
| `bookings` | Reservations with status workflow |
| `blocked_dates` | Owner blocks, maintenance |
| `pricing_rules` | Base/weekend/seasonal rates |
| `date_overrides` | Single-date price overrides |
| `coupons` | Discount codes |
| `photos` | Property images (currently using static) |
| `settings` | Key-value property config |
| `email_log` | Email tracking |

**Pricing Priority:** date_override (100) > seasonal (50) > weekend/weekday (10) > base (0)

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

# Resend (email)
RESEND_API_KEY=<resend-key>

# App config
VITE_APP_URL=https://studiozerosf.com  # or http://localhost:5173 for dev
OWNER_EMAIL=hello@studiozerosf.com     # Where owner approval emails are sent
```

## Commands

```bash
npm run dev      # Start dev server
npm run build    # TypeScript check + production build
npm run preview  # Preview production build
```

## Deployment Status

| Step | Status |
|------|--------|
| Deploy to Vercel | Done |
| Environment variables in Vercel | Done |
| Supabase migration (coupon function) | Done |
| Stripe webhook endpoint | Done |
| Email service setup | **IN PROGRESS** - Switched to SendGrid (Resend only allows 1 domain) |
| Cloudflare DNS to Vercel | Not started |

## Resume Here (Next Session)

**Email setup (SendGrid) - in progress:**
1. Add SendGrid DNS records to Cloudflare (CNAME/TXT records for domain verification)
2. Verify domain in SendGrid dashboard
3. Create SendGrid API key
4. Update code to use SendGrid instead of Resend
5. Add `SENDGRID_API_KEY` to Vercel environment variables

**Then:**
6. Point Cloudflare DNS to Vercel (`CNAME @ → cname.vercel-dns.com`)
7. Add `studiozerosf.com` domain in Vercel project settings
8. Test full booking flow

## Next Steps (After Launch)

1. Admin dashboard (calendar management, bookings list, settings)
2. Guest authentication (magic links for viewing/managing bookings)
3. Check-in instructions email (auto-send 24h before arrival)
4. iCal export for calendar sync

## Notes

- Owner approval emails go to: `dylan@dylandibona.com`
- Using SendGrid instead of Resend (Resend free tier only allows 1 domain, already used for mondayandpartners.com)
- Vercel preview URL available for testing before DNS cutover

## Code Conventions

- Use existing component patterns (Button, Container)
- Keep components presentation-only, logic in hooks/lib
- Use `date-fns` for date manipulation
- Format dates as `yyyy-MM-dd` for DB storage
- All pricing in dollars (not cents) until Stripe
- TypeScript strict mode enabled
