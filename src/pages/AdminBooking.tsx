import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { format, parseISO } from 'date-fns';
import type { Booking, BookingStatus } from '../types';

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-blue-50 text-blue-800 border-blue-200',
  confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-50 text-red-800 border-red-200',
  completed: 'bg-stone-100 text-stone-600 border-stone-200',
};

export function AdminBooking() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesChanged, setNotesChanged] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/admin/booking?id=${id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setBooking(data);
        setNotes(data.admin_notes || '');
      } catch (err) {
        console.error('Error fetching booking:', err);
      }
      setLoading(false);
    }

    if (id) fetchBooking();
  }, [id]);

  async function handleAction(action: string) {
    if (!booking) return;

    const confirmMessages: Record<string, string> = {
      approve: 'Approve this booking? This will capture the payment and notify the guest.',
      cancel: booking.amount_paid > 0
        ? 'Cancel this booking? This will refund the payment and notify the guest.'
        : 'Cancel this booking? This will release the authorization hold and notify the guest.',
      complete: 'Mark this booking as completed?',
    };

    if (!window.confirm(confirmMessages[action] || `Perform ${action}?`)) return;

    setActionLoading(action);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/booking?id=${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }

      const updated = await res.json();
      setBooking(updated);
      setMessage({ type: 'success', text: `Booking ${action === 'approve' ? 'approved' : action === 'cancel' ? 'cancelled' : 'completed'} successfully.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Something went wrong' });
    }
    setActionLoading(null);
  }

  async function handleSaveNotes() {
    if (!booking) return;

    setActionLoading('notes');
    try {
      const res = await fetch(`/api/admin/booking?id=${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes }),
      });

      if (!res.ok) throw new Error('Failed to save notes');

      const updated = await res.json();
      setBooking(updated);
      setNotesChanged(false);
      setMessage({ type: 'success', text: 'Notes saved.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save notes' });
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <Layout>
        <section className="py-12 md:py-20">
          <Container size="sm">
            <p className="text-text-secondary">Loading booking...</p>
          </Container>
        </section>
      </Layout>
    );
  }

  if (!booking) {
    return (
      <Layout>
        <section className="py-12 md:py-20">
          <Container size="sm">
            <p className="text-text-secondary mb-4">Booking not found.</p>
            <Link to="/admin">
              <Button variant="outline" size="sm">Back to Bookings</Button>
            </Link>
          </Container>
        </section>
      </Layout>
    );
  }

  const guest = booking.guest;
  const canApprove = booking.status === 'pending';
  const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed';
  const canComplete = booking.status === 'confirmed';

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <Container size="sm">
          {/* Back link */}
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            All Bookings
          </Link>

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
                Booking
              </p>
              <h1 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight">
                {guest ? `${guest.first_name} ${guest.last_name}` : 'Unknown Guest'}
              </h1>
            </div>
            <span className={`inline-block text-xs font-medium px-3 py-1.5 border ${STATUS_STYLES[booking.status]}`}>
              {booking.status}
            </span>
          </div>

          {/* Message */}
          {message && (
            <div className={`p-4 mb-6 border text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* Guest Info */}
          <div className="border border-border p-6 mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
              Guest
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Name</span>
                <span className="text-sm text-text-primary">{guest ? `${guest.first_name} ${guest.last_name}` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Email</span>
                <a href={`mailto:${guest?.email}`} className="text-sm text-text-primary underline underline-offset-2">
                  {guest?.email || '—'}
                </a>
              </div>
              {guest?.phone && (
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary">Phone</span>
                  <span className="text-sm text-text-primary">{guest.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stay Details */}
          <div className="border border-border p-6 mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
              Stay
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Check-in</span>
                <span className="text-sm text-text-primary">{format(parseISO(booking.check_in), 'EEE, MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Check-out</span>
                <span className="text-sm text-text-primary">{format(parseISO(booking.check_out), 'EEE, MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Nights</span>
                <span className="text-sm text-text-primary">{booking.nights}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Guests</span>
                <span className="text-sm text-text-primary">{booking.guests_count}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="border border-border p-6 mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
              Payment
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">{booking.nights} night{booking.nights !== 1 ? 's' : ''} x ${booking.nightly_rate.toFixed(2)}</span>
                <span className="text-sm text-text-primary">${booking.subtotal.toFixed(2)}</span>
              </div>
              {booking.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary">Discount</span>
                  <span className="text-sm text-emerald-700">-${booking.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Cleaning fee</span>
                <span className="text-sm text-text-primary">${booking.cleaning_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-sm font-medium text-text-primary">Total</span>
                <span className="text-sm font-medium text-text-primary">${booking.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Amount paid</span>
                <span className={`text-sm ${booking.amount_paid > 0 ? 'text-emerald-700 font-medium' : 'text-text-secondary'}`}>
                  ${booking.amount_paid.toFixed(2)}
                  {booking.amount_paid === 0 && booking.status === 'pending' && (
                    <span className="ml-2 text-xs text-amber-600">(authorization hold)</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Guest Notes */}
          {booking.guest_notes && (
            <div className="border border-border p-6 mb-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
                Guest Notes
              </p>
              <p className="text-sm text-text-primary leading-relaxed">{booking.guest_notes}</p>
            </div>
          )}

          {/* Admin Notes */}
          <div className="border border-border p-6 mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
              Admin Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesChanged(true); }}
              placeholder="Add internal notes about this booking..."
              className="w-full bg-surface border border-border p-3 text-sm text-text-primary placeholder:text-text-secondary/50 resize-y min-h-[80px] focus:outline-none focus:border-text-primary transition-colors"
              rows={3}
            />
            {notesChanged && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSaveNotes}
                  isLoading={actionLoading === 'notes'}
                >
                  Save Notes
                </Button>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="border border-border p-6 mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
              Details
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Booking ID</span>
                <span className="text-xs font-mono text-text-secondary">{booking.id}</span>
              </div>
              {booking.stripe_payment_intent && (
                <div className="flex justify-between">
                  <span className="text-sm text-text-secondary">Stripe PI</span>
                  <span className="text-xs font-mono text-text-secondary">{booking.stripe_payment_intent}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-text-secondary">Booked</span>
                <span className="text-sm text-text-primary">{format(parseISO(booking.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(canApprove || canCancel || canComplete) && (
            <div className="border border-border p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
                Actions
              </p>
              <div className="flex flex-wrap gap-3">
                {canApprove && (
                  <Button
                    onClick={() => handleAction('approve')}
                    isLoading={actionLoading === 'approve'}
                  >
                    Approve & Charge
                  </Button>
                )}
                {canComplete && (
                  <Button
                    variant="secondary"
                    onClick={() => handleAction('complete')}
                    isLoading={actionLoading === 'complete'}
                  >
                    Mark Completed
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="outline"
                    className="!text-red-600 !border-red-300 hover:!bg-red-50 hover:!text-red-700"
                    onClick={() => handleAction('cancel')}
                    isLoading={actionLoading === 'cancel'}
                  >
                    {booking.amount_paid > 0 ? 'Cancel & Refund' : 'Cancel Booking'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Container>
      </section>
    </Layout>
  );
}
