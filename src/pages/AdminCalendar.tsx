import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { format, parseISO, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isBefore, startOfDay } from 'date-fns';
import { adminFetch } from '../lib/adminFetch';
import type { BlockedDate, DateOverride, PricingRule } from '../types';
import type { AdminAuthContext } from '../components/admin/AdminAuth';

export function AdminCalendar() {
  const { logout } = useOutletContext<AdminAuthContext>();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Override form
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideRate, setOverrideRate] = useState('');
  const [overrideNote, setOverrideNote] = useState('');

  // Pricing rule edit
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [blockedRes, overrideRes, rulesRes, bookedRes] = await Promise.all([
        adminFetch('/api/admin/calendar?resource=blocked-dates'),
        adminFetch('/api/admin/calendar?resource=date-overrides'),
        adminFetch('/api/admin/calendar?resource=pricing-rules'),
        fetch('/api/booked-dates?start=' + format(new Date(), 'yyyy-MM-dd') + '&end=' + format(addMonths(new Date(), 12), 'yyyy-MM-dd')),
      ]);
      if (blockedRes.ok) setBlockedDates(await blockedRes.json());
      if (overrideRes.ok) setOverrides(await overrideRes.json());
      if (rulesRes.ok) setPricingRules(await rulesRes.json());
      if (bookedRes.ok) {
        const bookings: { check_in: string; check_out: string }[] = await bookedRes.json();
        const dates = new Set<string>();
        bookings.forEach(b => {
          const checkIn = parseISO(b.check_in);
          const checkOut = parseISO(b.check_out);
          const nights = eachDayOfInterval({ start: checkIn, end: new Date(checkOut.getTime() - 86400000) });
          nights.forEach(n => dates.add(format(n, 'yyyy-MM-dd')));
        });
        setBookedDates(dates);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    }
    setLoading(false);
  }

  const blockedSet = new Set(blockedDates.map(d => d.date));
  const overrideMap = new Map(overrides.map(o => [o.date, o]));

  function toggleDate(dateStr: string) {
    const next = new Set(selectedDates);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    setSelectedDates(next);
  }

  async function blockSelected() {
    if (selectedDates.size === 0) return;
    setMessage(null);
    try {
      const res = await adminFetch('/api/admin/calendar?resource=blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: Array.from(selectedDates), reason: 'owner_block' }),
      });
      if (!res.ok) throw new Error('Failed to block dates');
      setMessage({ type: 'success', text: `${selectedDates.size} date(s) blocked.` });
      setSelectedDates(new Set());
      fetchAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function unblockSelected() {
    const toUnblock = Array.from(selectedDates).filter(d => blockedSet.has(d));
    if (toUnblock.length === 0) return;
    setMessage(null);
    try {
      const res = await adminFetch('/api/admin/calendar?resource=blocked-dates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: toUnblock }),
      });
      if (!res.ok) throw new Error('Failed to unblock dates');
      setMessage({ type: 'success', text: `${toUnblock.length} date(s) unblocked.` });
      setSelectedDates(new Set());
      fetchAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await adminFetch('/api/admin/calendar?resource=date-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: overrideDate, nightly_rate: parseFloat(overrideRate), note: overrideNote || null }),
      });
      if (!res.ok) throw new Error('Failed to create override');
      setMessage({ type: 'success', text: 'Rate override saved.' });
      setShowOverrideForm(false);
      setOverrideDate('');
      setOverrideRate('');
      setOverrideNote('');
      fetchAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function deleteOverride(override: DateOverride) {
    if (!window.confirm(`Remove rate override for ${override.date}?`)) return;
    try {
      const res = await adminFetch(`/api/admin/calendar?resource=date-overrides&id=${override.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function updatePricingRule(id: string) {
    setMessage(null);
    try {
      const res = await adminFetch('/api/admin/calendar?resource=pricing-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nightly_rate: parseFloat(editRate) }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setMessage({ type: 'success', text: 'Rate updated.' });
      setEditingRule(null);
      fetchAll();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  // Calendar rendering
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const today = startOfDay(new Date());

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

          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">Admin</p>
            <h1 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight mb-4">Calendar & Rates</h1>
            <div className="flex gap-4 items-center">
              <Link to="/admin" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Bookings</Link>
              <Link to="/admin/coupons" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Coupons</Link>
              <span className="text-sm font-medium text-text-primary border-b-2 border-text-primary pb-1">Calendar</span>
              <span className="flex-1" />
              <button onClick={logout} className="text-xs text-text-secondary hover:text-text-primary transition-colors">Sign Out</button>
            </div>
          </div>

          {message && (
            <div className={`p-4 mb-6 border text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {message.text}
            </div>
          )}

          {loading ? (
            <p className="text-text-secondary">Loading...</p>
          ) : (
            <>
              {/* Calendar */}
              <div className="border border-border p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="text-text-secondary hover:text-text-primary transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <p className="font-serif text-xl text-text-primary">{format(currentMonth, 'MMMM yyyy')}</p>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-text-secondary hover:text-text-primary transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center font-mono text-[10px] uppercase tracking-wider text-text-secondary py-1">{d}</div>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isBlocked = blockedSet.has(dateStr);
                    const isBooked = bookedDates.has(dateStr);
                    const override = overrideMap.get(dateStr);
                    const isSelected = selectedDates.has(dateStr);
                    const isPast = isBefore(day, today);

                    return (
                      <button
                        key={dateStr}
                        onClick={() => !isPast && toggleDate(dateStr)}
                        disabled={isPast}
                        className={`relative p-2 text-center text-sm transition-colors border ${
                          isSelected
                            ? 'border-text-primary bg-text-primary/5'
                            : isBooked
                              ? 'border-emerald-200 bg-emerald-50'
                              : isBlocked
                                ? 'border-red-200 bg-red-50'
                                : override
                                  ? 'border-blue-200 bg-blue-50'
                                  : 'border-transparent hover:bg-surface'
                        } ${isPast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${
                          isToday(day) ? 'font-bold' : ''
                        }`}
                      >
                        <span className={`block ${isBooked ? 'text-emerald-700' : isBlocked ? 'text-red-600' : 'text-text-primary'}`}>
                          {format(day, 'd')}
                        </span>
                        {override && (
                          <span className="block text-[10px] text-blue-600 font-mono">${override.nightly_rate}</span>
                        )}
                        {isBooked && (
                          <span className="block text-[9px] text-emerald-600 font-mono">booked</span>
                        )}
                        {isBlocked && !isBooked && (
                          <span className="block text-[9px] text-red-500 font-mono">blocked</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-emerald-50 border border-emerald-200" />
                    <span className="text-xs text-text-secondary">Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-50 border border-red-200" />
                    <span className="text-xs text-text-secondary">Blocked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-50 border border-blue-200" />
                    <span className="text-xs text-text-secondary">Rate Override</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-text-primary/5 border border-text-primary" />
                    <span className="text-xs text-text-secondary">Selected</span>
                  </div>
                </div>
              </div>

              {/* Selection actions */}
              {selectedDates.size > 0 && (
                <div className="border border-border p-4 mb-8 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-text-secondary">{selectedDates.size} date(s) selected</span>
                  <Button size="sm" variant="outline" onClick={blockSelected}>Block Selected</Button>
                  <Button size="sm" variant="ghost" onClick={unblockSelected}>Unblock Selected</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedDates(new Set())}>Clear</Button>
                </div>
              )}

              {/* Rate Overrides */}
              <div className="border border-border p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">Date Rate Overrides</p>
                  <Button size="sm" variant="secondary" onClick={() => setShowOverrideForm(!showOverrideForm)}>
                    {showOverrideForm ? 'Cancel' : 'Add Override'}
                  </Button>
                </div>

                {showOverrideForm && (
                  <form onSubmit={handleOverrideSubmit} className="bg-surface p-4 mb-4 flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Date</label>
                      <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} required className="bg-white border border-border px-3 py-2 text-sm focus:outline-none focus:border-text-primary" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Rate ($)</label>
                      <input type="number" step="0.01" min="0" value={overrideRate} onChange={e => setOverrideRate(e.target.value)} required placeholder="200.00" className="bg-white border border-border px-3 py-2 text-sm w-28 focus:outline-none focus:border-text-primary" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Note (optional)</label>
                      <input type="text" value={overrideNote} onChange={e => setOverrideNote(e.target.value)} placeholder="e.g. Fleet Week" className="bg-white border border-border px-3 py-2 text-sm focus:outline-none focus:border-text-primary" />
                    </div>
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                )}

                {overrides.length === 0 ? (
                  <p className="text-sm text-text-secondary">No date overrides set.</p>
                ) : (
                  <div className="space-y-2">
                    {overrides.map(o => (
                      <div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <span className="text-sm text-text-primary">{format(parseISO(o.date), 'EEE, MMM d, yyyy')}</span>
                          {o.note && <span className="text-xs text-text-secondary ml-2">({o.note})</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-text-primary">${Number(o.nightly_rate).toFixed(2)}</span>
                          <button onClick={() => deleteOverride(o)} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Base Pricing Rules */}
              <div className="border border-border p-6">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">Base Pricing Rules</p>
                <div className="space-y-3">
                  {pricingRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="text-sm text-text-primary">{rule.name}</span>
                        <span className="text-xs text-text-secondary ml-2">({rule.rule_type}, priority {rule.priority})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {editingRule === rule.id ? (
                          <>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editRate}
                              onChange={e => setEditRate(e.target.value)}
                              className="bg-surface border border-border px-2 py-1 text-sm w-24 focus:outline-none focus:border-text-primary"
                            />
                            <Button size="sm" onClick={() => updatePricingRule(rule.id)}>Save</Button>
                            <button onClick={() => setEditingRule(null)} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-sm text-text-primary">${Number(rule.nightly_rate).toFixed(2)}/night</span>
                            <span className={`text-xs px-2 py-0.5 border ${rule.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                              {rule.is_active ? 'active' : 'inactive'}
                            </span>
                            <button
                              onClick={() => { setEditingRule(rule.id); setEditRate(String(rule.nightly_rate)); }}
                              className="text-xs text-text-secondary hover:text-text-primary underline underline-offset-2"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {pricingRules.length === 0 && (
                    <p className="text-sm text-text-secondary">No pricing rules configured.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </Container>
      </section>
    </Layout>
  );
}
