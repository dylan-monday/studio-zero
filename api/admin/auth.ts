import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

function generateAdminToken(): string {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  return createHmac('sha256', password).update(email).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    return res.status(500).json({ error: 'Admin credentials not configured' });
  }

  if (email.toLowerCase() === adminEmail && password === adminPassword) {
    return res.status(200).json({ token: generateAdminToken() });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}
