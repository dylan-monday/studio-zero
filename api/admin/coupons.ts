import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET — list all coupons
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch coupons' });
    }
    return res.status(200).json(data);
  }

  // POST — create coupon
  if (req.method === 'POST') {
    const { code, discount_type, discount_value, min_nights, max_uses, valid_from, valid_until, is_active } = req.body || {};

    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: 'Code, discount_type, and discount_value are required' });
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: code.toUpperCase().trim(),
        discount_type,
        discount_value,
        min_nights: min_nights || 1,
        max_uses: max_uses || null,
        valid_from: valid_from || null,
        valid_until: valid_until || null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A coupon with this code already exists' });
      }
      console.error('Error creating coupon:', error);
      return res.status(500).json({ error: 'Failed to create coupon' });
    }
    return res.status(201).json(data);
  }

  // PATCH — update coupon
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Coupon ID required' });
    }

    if (updates.code) {
      updates.code = updates.code.toUpperCase().trim();
    }

    const { data, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A coupon with this code already exists' });
      }
      console.error('Error updating coupon:', error);
      return res.status(500).json({ error: 'Failed to update coupon' });
    }
    return res.status(200).json(data);
  }

  // DELETE — delete coupon
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Coupon ID required' });
    }

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting coupon:', error);
      return res.status(500).json({ error: 'Failed to delete coupon' });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
