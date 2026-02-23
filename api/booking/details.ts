import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session.metadata) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.status(200).json({
      checkIn: session.metadata.checkIn,
      checkOut: session.metadata.checkOut,
      guestName: `${session.metadata.guestFirstName} ${session.metadata.guestLastName}`,
      guestEmail: session.metadata.guestEmail,
      total: parseFloat(session.metadata.total),
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    return res.status(500).json({ error: 'Failed to fetch booking details' });
  }
}
