import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { format, parseISO } from 'date-fns';
import { adminFetch } from '../lib/adminFetch';
import type { Booking, BookingStatus } from '../types';
import type { AdminAuthContext } from '../components/admin/AdminAuth';

type FilterStatus = 'all' | BookingStatus;

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-blue-50 text-blue-800 border-blue-200',
  confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-50 text-red-800 border-red-200',
  completed: 'bg-stone-100 text-stone-600 border-stone-200',
};

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

export function Admin() {
  const { logout } = useOutletContext<AdminAuthContext>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    async function fetchBookings() {
      try {
        const res = await adminFetch('/api/admin/bookings');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setBookings(data);
      } catch (err) {
        console.error('Error fetching bookings:', err);
      }
      setLoading(false);
    }

    fetchBookings();
  }, []);

  const filtered = filter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === filter);

  const counts = bookings.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      acc.all += 1;
      return acc;
    },
    { all: 0 } as Record<string, number>,
  );

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <Container size="full">
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
              Admin
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight mb-4">
              Bookings
            </h1>
            <div className="flex gap-4 items-center">
              <span className="text-sm font-medium text-text-primary border-b-2 border-text-primary pb-1">Bookings</span>
              <Link to="/admin/coupons" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Coupons</Link>
              <Link to="/admin/calendar" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Calendar</Link>
              <Link to="/admin/emails" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Emails</Link>
              <span className="flex-1" />
              <button onClick={logout} className="text-xs text-text-secondary hover:text-text-primary transition-colors">Sign Out</button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`font-mono text-xs uppercase tracking-wider px-4 py-2 border transition-colors whitespace-nowrap ${
                  filter === opt.value
                    ? 'bg-text-primary text-white border-text-primary'
                    : 'bg-transparent text-text-secondary border-border hover:border-text-primary hover:text-text-primary'
                }`}
              >
                {opt.label}
                {counts[opt.value] != null && (
                  <span className="ml-2 opacity-60">{counts[opt.value]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <p className="text-text-secondary">Loading bookings...</p>
          ) : filtered.length === 0 ? (
            <div className="border border-border p-12 text-center">
              <p className="text-text-secondary">No bookings found.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Guest</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Dates</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Nights</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Status</th>
                      <th className="text-right font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Total</th>
                      <th className="text-right font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Paid</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Booked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((booking) => (
                      <tr key={booking.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/admin/booking/${booking.id}`}>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-text-primary">
                            {booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {booking.guest?.email}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-text-primary">
                            {format(parseISO(booking.check_in), 'MMM d')} — {format(parseISO(booking.check_out), 'MMM d, yyyy')}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary">
                          {booking.nights}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-block text-xs font-medium px-2.5 py-1 border ${STATUS_STYLES[booking.status]}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary text-right">
                          ${booking.total_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-sm text-right">
                          <span className={booking.amount_paid > 0 ? 'text-emerald-700' : 'text-text-secondary'}>
                            ${booking.amount_paid.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-text-secondary">
                          {format(parseISO(booking.created_at), 'MMM d, h:mm a')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((booking) => (
                  <Link key={booking.id} to={`/admin/booking/${booking.id}`} className="block border border-border p-4 hover:bg-surface/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {booking.guest ? `${booking.guest.first_name} ${booking.guest.last_name}` : 'Unknown'}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {booking.guest?.email}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 border ${STATUS_STYLES[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Dates</p>
                        <p className="text-text-primary">
                          {format(parseISO(booking.check_in), 'MMM d')} — {format(parseISO(booking.check_out), 'MMM d')}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Total</p>
                        <p className="text-text-primary">${booking.total_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Nights</p>
                        <p className="text-text-primary">{booking.nights}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Paid</p>
                        <p className={booking.amount_paid > 0 ? 'text-emerald-700' : 'text-text-secondary'}>
                          ${booking.amount_paid.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </Container>
      </section>
    </Layout>
  );
}
