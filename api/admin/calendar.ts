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

  const { resource } = req.query;

  if (resource === 'blocked-dates') return handleBlockedDates(req, res);
  if (resource === 'date-overrides') return handleDateOverrides(req, res);
  if (resource === 'pricing-rules') return handlePricingRules(req, res);

  return res.status(400).json({ error: 'Invalid resource. Use ?resource=blocked-dates|date-overrides|pricing-rules' });
}

async function handleBlockedDates(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*')
      .order('date', { ascending: true });
    if (error) return res.status(500).json({ error: 'Failed to fetch' });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { dates, reason } = req.body || {};
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates array required' });
    }

    const rows = dates.map((date: string) => ({
      date,
      reason: reason || 'owner_block',
    }));

    const { data, error } = await supabase
      .from('blocked_dates')
      .upsert(rows, { onConflict: 'date' })
      .select();

    if (error) {
      console.error('Error blocking dates:', error);
      return res.status(500).json({ error: 'Failed to block dates' });
    }
    return res.status(201).json(data);
  }

  if (req.method === 'DELETE') {
    const { dates } = req.body || {};
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates array required' });
    }

    const { error } = await supabase
      .from('blocked_dates')
      .delete()
      .in('date', dates);

    if (error) {
      console.error('Error unblocking dates:', error);
      return res.status(500).json({ error: 'Failed to unblock dates' });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleDateOverrides(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('date_overrides')
      .select('*')
      .order('date', { ascending: true });
    if (error) return res.status(500).json({ error: 'Failed to fetch' });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { date, nightly_rate, note } = req.body || {};
    if (!date || nightly_rate === undefined) {
      return res.status(400).json({ error: 'date and nightly_rate required' });
    }

    const { data, error } = await supabase
      .from('date_overrides')
      .upsert({ date, nightly_rate, note: note || null }, { onConflict: 'date' })
      .select()
      .single();

    if (error) {
      console.error('Error creating date override:', error);
      return res.status(500).json({ error: 'Failed to create override' });
    }
    return res.status(201).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Override ID required' });
    }

    const { error } = await supabase.from('date_overrides').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete' });
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handlePricingRules(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .order('priority', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch' });
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Rule ID required' });

    const { data, error } = await supabase
      .from('pricing_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pricing rule:', error);
      return res.status(500).json({ error: 'Failed to update' });
    }
    return res.status(200).json(data);
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
