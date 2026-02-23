# Studio Zero SF - Project Context

## Project Vision

Studio Zero SF is a custom direct-booking platform for a single studio apartment in San Francisco. The goal is to replace Lodgify with a lean, beautiful, purpose-built solution that provides:

1. Direct bookings with Stripe payment processing
2. Owner approval workflow before confirming reservations
3. Guest accounts with booking history and saved details
4. Clean, minimal UI that showcases the space
5. Simple admin for managing rates, photos, coupons, and bookings
6. Automated email communications throughout the guest journey

---

## Technical Architecture

### Stack Overview

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite | React 19.2, Vite 7.3 |
| Language | TypeScript | 5.9 (strict mode) |
| Styling | Tailwind CSS | v4.1 |
| Backend/DB | Supabase | PostgreSQL + Auth + Storage |
| Payments | Stripe | Checkout Sessions + Webhooks |
| Email | Resend | React Email templates |
| Date Utils | date-fns | 4.1 |
| Routing | React Router | 7.13 |

### Project Structure

```
studio-zero-sf/
├── public/
│   └── photos/                    # Property images
│       ├── bed.jpg (hero)
│       ├── studio.jpg
│       ├── workspace.jpg
│       ├── bathroom.jpg
│       ├── shower.jpg
│       └── neighborhood.png
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx         # Reusable button (4 variants, 3 sizes)
│   │   │   └── Container.tsx      # Responsive max-width wrapper
│   │   ├── layout/
│   │   │   ├── Header.tsx         # Sticky nav with logo + CTAs
│   │   │   ├── Footer.tsx         # Footer links
│   │   │   └── Layout.tsx         # Page wrapper (Header + Footer)
│   │   ├── booking/
│   │   │   └── AvailabilityCalendar.tsx  # Interactive date picker
│   │   └── gallery/
│   │       └── PhotoGallery.tsx   # Grid + lightbox (supports static photos)
│   ├── pages/
│   │   ├── Home.tsx               # Landing page (fully built)
│   │   └── Book.tsx               # 3-step booking flow
│   ├── hooks/
│   │   └── useAvailability.ts     # Fetches calendar availability data
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client initialization
│   │   ├── pricing.ts             # Pricing calculation engine
│   │   └── availability.ts        # Availability helpers
│   ├── types/
│   │   └── index.ts               # All TypeScript interfaces
│   ├── App.tsx                    # Router configuration
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Tailwind + design tokens
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql # Database tables + seed data
│       └── 002_row_level_security.sql # RLS policies
├── package.json
├── vite.config.ts
├── tsconfig.json
├── studio-zero-sf-spec.md         # Full project specification
├── claude.md                      # Claude quick reference
└── PROJECT-CONTEXT.md             # This file
```

---

## What Has Been Built

### Phase 1 Progress

#### 1. Project Foundation
- Vite + React 19 + TypeScript scaffolding
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Custom design system with CSS variables
- ESLint configuration
- Environment variable setup

#### 2. Design System (`src/index.css`)

**Color Palette:**
```css
--color-background: #ffffff;
--color-surface: #fafafa;
--color-border: #e5e5e5;
--color-text-primary: #1a1a1a;
--color-text-secondary: #6b7280;
--color-accent: #2563eb;
--color-accent-hover: #1d4ed8;
--color-success: #059669;
--color-warning: #d97706;
--color-error: #dc2626;
```

**Typography:** Inter font family with system fallbacks

**Components follow these patterns:**
- Mobile-first responsive design
- Rounded corners (`rounded-lg`, `rounded-xl`)
- Subtle borders and shadows
- Blue accent for CTAs
- Generous whitespace

#### 3. Database Schema (`supabase/migrations/`)

**8 Tables Created:**

| Table | Fields | Purpose |
|-------|--------|---------|
| `guests` | id, email, first_name, last_name, phone, address_* | Guest profiles |
| `bookings` | id, guest_id, check_in, check_out, nights (computed), status, pricing fields, stripe_*, coupon_id, notes | Reservations |
| `blocked_dates` | id, date, reason | Owner blocks |
| `pricing_rules` | id, name, rule_type, priority, nightly_rate, start/end_date, days_of_week | Dynamic pricing |
| `date_overrides` | id, date, nightly_rate, note | Single-date prices |
| `coupons` | id, code, discount_type, discount_value, min_nights, max_uses, valid dates | Discount codes |
| `photos` | id, storage_path, url, caption, alt_text, display_order, is_hero | Gallery images |
| `settings` | key, value (JSONB) | Property config |
| `email_log` | id, booking_id, email_type, recipient, sent_at | Email tracking |

**Seed Data:**
- Property settings (cleaning fee, rates, house rules, etc.)
- Base pricing rule ($165/night)
- Weekend pricing rule ($185/night for Fri/Sat)

**Row Level Security:**
- Guests can only access their own data
- Public read access to photos, settings, availability
- Admin role has full access to all tables

#### 4. Landing Page (`src/pages/Home.tsx`)

**Sections Built:**
1. Hero - Full-bleed image with overlay, title, CTA
2. Quick Info Bar - Guests, bedroom, bathroom, minimum nights
3. Photo Gallery - 5-photo grid with lightbox
4. About This Place - Description + amenities list
5. House Rules - 6 rule cards with icons
6. Neighborhood - Description + map placeholder (now showing neighborhood.png)
7. Availability Calendar - Interactive calendar component
8. CTA Section - Dark background final push

**Features:**
- Uses local photos from `public/photos/`
- bed.jpg as hero image
- Responsive grid layouts
- Smooth hover transitions

#### 5. Booking Flow (`src/pages/Book.tsx`)

**3-Step Process:**

**Step 1 - Dates:**
- Interactive calendar with availability checking
- Check-in/check-out date selection
- Minimum nights validation
- Guest count selector (1-2)
- Coupon code input with validation
- Real-time price updates

**Step 2 - Details:**
- Guest information form
- Email, first name, last name, phone
- Special requests textarea
- Auto-fill for returning guests (email lookup)
- Form validation with error messages

**Step 3 - Review:**
- Booking summary (dates, duration, guests)
- Guest information display
- "Proceed to Payment" button (placeholder for Stripe)

**Sidebar:**
- Sticky price summary
- Nightly breakdown
- Subtotal, cleaning fee, discount, total
- Property info (min nights, check-in/out times)

#### 6. Pricing Engine (`src/lib/pricing.ts`)

**Functions:**
- `fetchPricingData()` - Gets rules, overrides, cleaning fee
- `getRateForDate()` - Calculates rate with priority system
- `validateCoupon()` - Checks coupon validity
- `calculateDiscount()` - Applies percentage or fixed discount
- `calculatePrice()` - Full async calculation
- `calculatePriceSync()` - Sync version for real-time UI

**Priority System:**
```
date_override: 100 (highest)
seasonal: 50
weekend/weekday: 10
base: 0 (lowest)
```

**Logic:**
- For each night, find all applicable rules
- Sort by priority, use highest
- Check date ranges for seasonal rules
- Check day of week for weekend rules (Fri=5, Sat=6)

#### 7. Availability Helper (`src/lib/availability.ts`)

**Functions:**
- `getUnavailableDates()` - Combines blocked_dates + booked ranges
- `isDateRangeAvailable()` - Validates a booking range
- `getMinNights()` - Fetches setting
- `getMaxGuests()` - Fetches setting

#### 8. Property Photos

**Moved from `_photos/` to `public/photos/`:**
- `bed.jpg` - Hero image (queen bed)
- `bed-2.jpg` - Alternate bed view
- `studio.jpg` - Living space
- `workspace.jpg` - Personal work area
- `bathroom.jpg` - Bathroom
- `bathroom-2.jpg` - Alternate bathroom
- `shower.jpg` - Walk-in shower
- `shower-2.jpg` - Alternate shower
- `neighborhood.png` - Neighborhood/map image

---

## How It Works

### Booking Flow (Current Implementation)

```
User visits /book
    ↓
Step 1: Select Dates
- Calendar fetches availability from Supabase
- User clicks dates for check-in/check-out
- System validates min nights
- Real-time pricing calculation
- Optional coupon code entry
    ↓
Step 2: Guest Details
- User enters email, name, phone
- If email exists, auto-fill from guests table
- Form validation
    ↓
Step 3: Review
- Display booking summary
- Show price breakdown
- "Proceed to Payment" (currently placeholder)
```

### Pricing Calculation Flow

```
calculatePrice(checkIn, checkOut, couponCode?)
    ↓
1. Fetch pricing_rules (active only)
2. Fetch date_overrides
3. Fetch cleaning_fee from settings
    ↓
4. For each night in range:
   - Check for date_override (priority 100)
   - Check seasonal rules (priority 50)
   - Check weekend/weekday rules (priority 10)
   - Fall back to base rate (priority 0)
   - Use highest priority rate
    ↓
5. Sum all nightly rates = subtotal
6. If coupon: validate & calculate discount
7. Total = subtotal + cleaning_fee - discount
```

### Availability Check Flow

```
getUnavailableDates(startDate, endDate)
    ↓
1. Fetch blocked_dates in range
2. Fetch bookings with status: pending/approved/confirmed
3. Expand booking date ranges to individual nights
4. Mark past dates as unavailable
5. Return combined unavailable dates with reasons
```

---

## What's Next

### Immediate (Phase 1 Completion)

1. **Stripe Integration**
   - Create Checkout Session on "Proceed to Payment"
   - Redirect to Stripe hosted checkout
   - Handle success/cancel URLs

2. **Webhook Handler**
   - Verify Stripe signature
   - On `checkout.session.completed`:
     - Create booking record in Supabase
     - Send confirmation emails
   - Handle `charge.refunded` events

3. **Email Templates**
   - `booking-pending.tsx` - "We've received your request"
   - `booking-confirmed.tsx` - "Your booking is confirmed"
   - `owner-new-booking.tsx` - "New booking to review"

4. **Owner Approval**
   - Generate approval tokens
   - Email links: `/admin/approve/:token`, `/admin/deny/:token`
   - Update booking status

5. **Success Page**
   - `/book/success` route
   - "Awaiting approval" message
   - Booking confirmation details

### Phase 2 (Admin Dashboard)

- Admin authentication
- Dashboard with stats
- Bookings list with filters
- Calendar view
- Pricing rules management
- Photo management
- Settings editor

### Phase 3 (Guest Experience)

- Magic link authentication
- Guest account page
- Booking history
- Modification requests
- Cancellation flow

---

## Development Notes

### Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Setup

Create `.env.local` with:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
RESEND_API_KEY=re_...
VITE_APP_URL=http://localhost:5173
```

### Database Setup

Run migrations in Supabase SQL Editor:
1. `001_initial_schema.sql` - Creates tables + seed data
2. `002_row_level_security.sql` - Enables RLS policies

### Code Patterns

**Components:**
- Functional components with TypeScript
- Use existing Button/Container for consistency
- Tailwind utility classes for styling
- forwardRef for ref forwarding

**Hooks:**
- Custom hooks for data fetching
- Return loading/error states
- Use useCallback for memoization

**Lib functions:**
- Pure functions where possible
- Async for Supabase queries
- Strong TypeScript typing

**Dates:**
- Use date-fns exclusively
- Format: `yyyy-MM-dd` for storage
- Date objects for manipulation

---

## Technical Decisions

### Why React 19?
Latest stable with improved performance and concurrent features.

### Why Tailwind v4?
New architecture with better performance, CSS variables support, no config file needed.

### Why Supabase?
All-in-one solution: PostgreSQL, Auth, Storage, Edge Functions, Row Level Security.

### Why local photos instead of Supabase Storage?
Simpler for MVP. Photos are static, don't change often. Can migrate to Storage later for admin photo management.

### Why 3-step booking flow?
Progressive disclosure reduces cognitive load. Users see dates/pricing first, then commit to entering details.

### Why sync + async pricing functions?
- `calculatePriceSync()` for immediate UI feedback while typing
- `calculatePrice()` for final validation with coupon check

---

## Known Issues / TODOs

- [ ] Stripe integration not yet implemented
- [ ] No error boundary for failed Supabase connections
- [ ] Calendar doesn't show pricing on hover (future enhancement)
- [ ] No loading state during date availability check
- [ ] Mobile keyboard may cover form inputs
- [ ] Need to add meta tags for SEO

---

*Last updated: February 2025*
