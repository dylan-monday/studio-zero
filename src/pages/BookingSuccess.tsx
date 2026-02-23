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
      <div className="py-12 md:py-20">
        <Container size="sm">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6">
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

            <h1 className="text-3xl md:text-4xl font-semibold text-text-primary mb-4">
              Booking Request Received!
            </h1>

            <p className="text-lg text-text-secondary mb-8 max-w-md mx-auto">
              Thank you for your booking request. Your payment has been processed
              and the host will review your request shortly.
            </p>

            {/* Booking Details Card */}
            {loading ? (
              <div className="bg-white rounded-xl border border-border p-6 mb-8 animate-pulse">
                <div className="h-4 bg-surface rounded w-3/4 mx-auto mb-4" />
                <div className="h-4 bg-surface rounded w-1/2 mx-auto" />
              </div>
            ) : booking ? (
              <div className="bg-white rounded-xl border border-border p-6 mb-8 text-left">
                <h2 className="text-lg font-semibold text-text-primary mb-4 text-center">
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
                    <span className="text-text-secondary">Total paid</span>
                    <span className="font-semibold text-lg">${booking.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border p-6 mb-8">
                <p className="text-text-secondary">
                  A confirmation email has been sent to your email address.
                </p>
              </div>
            )}

            {/* What's Next */}
            <div className="bg-surface rounded-xl p-6 mb-8 text-left">
              <h2 className="text-lg font-semibold text-text-primary mb-4">What happens next?</h2>
              <ol className="space-y-3 text-text-secondary">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </span>
                  <span>The host will review your booking request (usually within a few hours)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </span>
                  <span>You'll receive a confirmation email once approved</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-sm font-medium">
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
