import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function generateAdminToken(): string {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  return crypto.createHmac('sha256', password).update(email).digest('hex');
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = generateAdminToken();
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Checks the Authorization header for a valid admin token.
 * Returns true if valid, sends 401 and returns false if not.
 */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;

  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
