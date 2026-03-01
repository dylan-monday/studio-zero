import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { start, end } = req.query;

  if (!start || !end || typeof start !== 'string' || typeof end !== 'string') {
    return res.status(400).json({ error: 'start and end query params required (yyyy-MM-dd)' });
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('check_in, check_out')
    .in('status', ['pending', 'approved', 'confirmed'])
    .lte('check_in', end)
    .gte('check_out', start);

  if (error) {
    console.error('Error fetching booked dates:', error);
    return res.status(500).json({ error: 'Failed to fetch booked dates' });
  }

  // Cache for 5 minutes — availability doesn't change that fast
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.status(200).json(data || []);
}
