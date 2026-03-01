import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';

interface BookingDetails {
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  total: number;
}

export function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBookingDetails() {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/booking/details?session_id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setBooking(data);
        }
      } catch (err) {
        console.error('Failed to fetch booking details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBookingDetails();
  }, [sessionId]);

  return (
    <Layout>
      <div className="py-16 md:py-24">
        <Container size="sm">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-8">
              <svg
                className="w-8 h-8 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
              Request Submitted
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-text-primary mb-4 tracking-tight">
              Booking Request Received
            </h1>

            <p className="text-lg text-text-secondary mb-10 max-w-md mx-auto leading-relaxed">
              Thank you for your booking request. Your card has been authorized
              but won't be charged until the host confirms your stay.
            </p>

            {/* Booking Details Card */}
            {loading ? (
              <div className="border border-border p-6 mb-8 animate-pulse">
                <div className="h-4 bg-surface w-3/4 mx-auto mb-4" />
                <div className="h-4 bg-surface w-1/2 mx-auto" />
              </div>
            ) : booking ? (
              <div className="border border-border p-6 mb-8 text-left">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 text-center">
                  Your Booking
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-text-secondary">Check-in</span>
                    <span className="font-medium">{formatDate(booking.checkIn)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-text-secondary">Check-out</span>
                    <span className="font-medium">{formatDate(booking.checkOut)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-text-secondary">Confirmation sent to</span>
                    <span className="font-medium">{booking.guestEmail}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-text-secondary">Total</span>
                    <span className="font-serif text-xl">${booking.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-border p-6 mb-8">
                <p className="text-text-secondary">
                  A confirmation email has been sent to your email address.
                </p>
              </div>
            )}

            {/* What's Next */}
            <div className="bg-surface p-6 mb-10 text-left">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">What happens next?</h2>
              <ol className="space-y-4 text-text-secondary">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-text-primary/10 text-text-primary rounded-full flex items-center justify-center text-xs font-mono">
                    1
                  </span>
                  <span>The host will review your booking request (usually within a few hours)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-text-primary/10 text-text-primary rounded-full flex items-center justify-center text-xs font-mono">
                    2
                  </span>
                  <span>You'll receive a confirmation email once approved</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-text-primary/10 text-text-primary rounded-full flex items-center justify-center text-xs font-mono">
                    3
                  </span>
                  <span>Check-in instructions will be sent 24 hours before your stay</span>
                </li>
              </ol>
            </div>

            {/* CTA */}
            <Link to="/">
              <Button size="lg">Back to Home</Button>
            </Link>
          </div>
        </Container>
      </div>
    </Layout>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
