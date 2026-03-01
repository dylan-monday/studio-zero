import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { adminFetch } from '../lib/adminFetch';
import type { Coupon } from '../types';
import type { AdminAuthContext } from '../components/admin/AdminAuth';

interface CouponFormData {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  min_nights: string;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const emptyForm: CouponFormData = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  min_nights: '1',
  max_uses: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
};

export function AdminCoupons() {
  const { logout } = useOutletContext<AdminAuthContext>();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    try {
      const res = await adminFetch('/api/admin/coupons');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCoupons(data);
    } catch (err) {
      console.error('Error fetching coupons:', err);
    }
    setLoading(false);
  }

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_nights: String(coupon.min_nights),
      max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
      valid_from: coupon.valid_from || '',
      valid_until: coupon.valid_until || '',
      is_active: coupon.is_active,
    });
    setShowForm(true);
    setMessage(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload: any = {
      code: form.code,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_nights: parseInt(form.min_nights) || 1,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      is_active: form.is_active,
    };

    try {
      let res: Response;
      if (editingId) {
        res = await adminFetch('/api/admin/coupons', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await adminFetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setMessage({ type: 'success', text: editingId ? 'Coupon updated.' : 'Coupon created.' });
      cancelForm();
      fetchCoupons();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
    setSaving(false);
  }

  async function handleDelete(coupon: Coupon) {
    if (!window.confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;

    try {
      const res = await adminFetch(`/api/admin/coupons?id=${coupon.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setMessage({ type: 'success', text: 'Coupon deleted.' });
      fetchCoupons();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleToggleActive(coupon: Coupon) {
    try {
      const res = await adminFetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchCoupons();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <Container size="lg">
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

          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
                Admin
              </p>
              <h1 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight mb-4">
                Coupon Codes
              </h1>
              <div className="flex gap-4 items-center">
                <Link to="/admin" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Bookings</Link>
                <span className="text-sm font-medium text-text-primary border-b-2 border-text-primary pb-1">Coupons</span>
                <Link to="/admin/calendar" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Calendar</Link>
                <span className="flex-1" />
                <button onClick={logout} className="text-xs text-text-secondary hover:text-text-primary transition-colors">Sign Out</button>
              </div>
            </div>
            {!showForm && (
              <Button size="sm" onClick={startCreate}>
                New Coupon
              </Button>
            )}
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

          {/* Create/Edit Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="border border-border p-6 mb-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-6">
                {editingId ? 'Edit Coupon' : 'New Coupon'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. WELCOME20"
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">Discount Type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Discount Value {form.discount_type === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    placeholder={form.discount_type === 'percentage' ? '20' : '50.00'}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">Min Nights</label>
                  <input
                    type="number"
                    min="1"
                    value={form.min_nights}
                    onChange={(e) => setForm({ ...form, min_nights: e.target.value })}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">Max Uses (blank = unlimited)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">Valid From (optional)</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">Valid Until (optional)</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active" className="text-sm text-text-primary">Active</label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" size="sm" isLoading={saving}>
                  {editingId ? 'Save Changes' : 'Create Coupon'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Coupons List */}
          {loading ? (
            <p className="text-text-secondary">Loading coupons...</p>
          ) : coupons.length === 0 ? (
            <div className="border border-border p-12 text-center">
              <p className="text-text-secondary mb-4">No coupon codes yet.</p>
              {!showForm && (
                <Button size="sm" onClick={startCreate}>Create Your First Coupon</Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Code</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Discount</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Min Nights</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Uses</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Valid</th>
                      <th className="text-left font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Status</th>
                      <th className="text-right font-mono text-[11px] uppercase tracking-wider text-text-secondary px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((coupon) => (
                      <tr key={coupon.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm font-medium text-text-primary">{coupon.code}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary">
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.discount_value}%`
                            : `$${Number(coupon.discount_value).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary">
                          {coupon.min_nights}+
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary">
                          {coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                        </td>
                        <td className="px-4 py-4 text-xs text-text-secondary">
                          {coupon.valid_from || coupon.valid_until
                            ? `${coupon.valid_from || '...'} → ${coupon.valid_until || '...'}`
                            : 'Always'}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleToggleActive(coupon)}
                            className={`text-xs font-medium px-2.5 py-1 border cursor-pointer transition-colors ${
                              coupon.is_active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                            }`}
                          >
                            {coupon.is_active ? 'active' : 'inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => startEdit(coupon)}
                              className="text-xs text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(coupon)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors underline underline-offset-2"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {coupons.map((coupon) => (
                  <div key={coupon.id} className="border border-border p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-sm font-medium text-text-primary">{coupon.code}</span>
                        <p className="text-sm text-text-secondary mt-0.5">
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.discount_value}% off`
                            : `$${Number(coupon.discount_value).toFixed(2)} off`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleActive(coupon)}
                        className={`text-xs font-medium px-2.5 py-1 border ${
                          coupon.is_active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                      >
                        {coupon.is_active ? 'active' : 'inactive'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Min Nights</p>
                        <p className="text-text-primary">{coupon.min_nights}+</p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Uses</p>
                        <p className="text-text-primary">{coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(coupon)} className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2">Edit</button>
                      <button onClick={() => handleDelete(coupon)} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Container>
      </section>
    </Layout>
  );
}
