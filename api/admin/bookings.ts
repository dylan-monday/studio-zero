import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const expected = createHmac('sha256', password).update(email).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      res.status(401).json({ error: 'Unauthorized' }); return false;
    }
  } catch { res.status(401).json({ error: 'Unauthorized' }); return false; }
  return true;
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        guest:guests(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }

    return res.status(200).json(bookings);
  } catch (error) {
    console.error('Admin bookings error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
