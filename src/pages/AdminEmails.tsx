import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { adminFetch } from '../lib/adminFetch';
import type { AdminAuthContext } from '../components/admin/AdminAuth';

type EmailType = 'guest_pending' | 'owner_approval' | 'guest_confirmed' | 'guest_declined' | 'checkin';

const EMAIL_TABS: { value: EmailType; label: string }[] = [
  { value: 'guest_pending', label: 'Pending' },
  { value: 'guest_confirmed', label: 'Confirmed' },
  { value: 'guest_declined', label: 'Declined' },
  { value: 'owner_approval', label: 'Owner' },
  { value: 'checkin', label: 'Check-in' },
];

interface EntryStep {
  label: string;
  detail: string;
}

// Shape of all content from the API
interface AllEmailContent {
  guest_pending: { subject: string; body: string; footer: string };
  owner_approval: { subject_template: string; auth_note: string; approve_label: string; decline_label: string };
  guest_confirmed: { subject: string; body: string; whats_next: string; footer: string };
  guest_declined: { subject: string; body: string; secondary: string; cta_text: string };
  checkin: {
    subject: string;
    address: string;
    city_state_zip: string;
    address_note: string;
    maps_url: string;
    entry_steps: EntryStep[];
    key_warning: string;
    lost_key_fee: string;
    wifi_network: string;
    wifi_password: string;
    tips: string[];
    checkout_reminders: string[];
    emergency_name: string;
    emergency_role: string;
    emergency_email: string;
    emergency_phone: string;
  };
}

export function AdminEmails() {
  const { logout } = useOutletContext<AdminAuthContext>();
  const [content, setContent] = useState<AllEmailContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EmailType>('guest_pending');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchContent();
  }, []);

  async function fetchContent() {
    try {
      const res = await adminFetch('/api/admin/emails');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setContent(data);
    } catch (err) {
      console.error('Error fetching email content:', err);
      setFetchError(true);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!content) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await adminFetch('/api/admin/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab, content: content[activeTab] }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setMessage({ type: 'success', text: 'Saved' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    }
    setSaving(false);
  }

  async function handleSendTest() {
    setTesting(true);
    setMessage(null);
    try {
      // Save first
      if (content) {
        await adminFetch('/api/admin/emails', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: activeTab, content: content[activeTab] }),
        });
      }
      const res = await adminFetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', type: activeTab }),
      });
      if (!res.ok) throw new Error('Failed to send');
      const data = await res.json();
      setMessage({ type: 'success', text: `Test email sent to ${data.sent_to}` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to send test email' });
    }
    setTesting(false);
  }

  function updateField(type: EmailType, field: string, value: unknown) {
    if (!content) return;
    setContent({
      ...content,
      [type]: { ...content[type], [field]: value },
    });
    setMessage(null);
  }

  if (loading) {
    return (
      <Layout>
        <section className="py-12 md:py-20">
          <Container size="full">
            <p className="text-text-secondary">Loading email content...</p>
          </Container>
        </section>
      </Layout>
    );
  }

  if (fetchError || !content) {
    return (
      <Layout>
        <section className="py-12 md:py-20">
          <Container size="full">
            <p className="text-red-600 mb-4">Failed to load email content. The API may not be deployed yet.</p>
            <Button variant="outline" size="sm" onClick={() => { setFetchError(false); setLoading(true); fetchContent(); }}>
              Retry
            </Button>
          </Container>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <Container size="full">
          {/* Header */}
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">Admin</p>
            <h1 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight mb-4">Emails</h1>
            <div className="flex gap-4 items-center">
              <Link to="/admin" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Bookings</Link>
              <Link to="/admin/coupons" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Coupons</Link>
              <Link to="/admin/calendar" className="text-sm text-text-secondary hover:text-text-primary transition-colors pb-1">Calendar</Link>
              <span className="text-sm font-medium text-text-primary border-b-2 border-text-primary pb-1">Emails</span>
              <span className="flex-1" />
              <button onClick={logout} className="text-xs text-text-secondary hover:text-text-primary transition-colors">Sign Out</button>
            </div>
          </div>

          {/* Email type tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {EMAIL_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setMessage(null); }}
                className={`font-mono text-xs uppercase tracking-wider px-4 py-2 border transition-colors whitespace-nowrap ${
                  activeTab === tab.value
                    ? 'bg-text-primary text-white border-text-primary'
                    : 'bg-transparent text-text-secondary border-border hover:border-text-primary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content editor */}
          <div className="border border-border p-6 md:p-8 mb-6">
            {activeTab === 'guest_pending' && <GuestPendingForm content={content.guest_pending} onChange={(f, v) => updateField('guest_pending', f, v)} />}
            {activeTab === 'owner_approval' && <OwnerApprovalForm content={content.owner_approval} onChange={(f, v) => updateField('owner_approval', f, v)} />}
            {activeTab === 'guest_confirmed' && <GuestConfirmedForm content={content.guest_confirmed} onChange={(f, v) => updateField('guest_confirmed', f, v)} />}
            {activeTab === 'guest_declined' && <GuestDeclinedForm content={content.guest_declined} onChange={(f, v) => updateField('guest_declined', f, v)} />}
            {activeTab === 'checkin' && <CheckinForm content={content.checkin} onChange={(f, v) => updateField('checkin', f, v)} />}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={handleSendTest} disabled={testing}>
              {testing ? 'Sending...' : 'Send Test Email'}
            </Button>
            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
          </div>

          <p className="text-xs text-text-secondary mt-4">
            Dynamic variables like guest name, dates, and amounts are auto-populated. Test emails use sample data.
          </p>
        </Container>
      </section>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Form Components
// ---------------------------------------------------------------------------

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">{label}</label>
      {hint && <p className="text-xs text-text-secondary/70 mt-0.5">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-border bg-white p-3 text-sm focus:outline-none focus:border-text-primary transition-colors"
    />
  );
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full border border-border bg-white p-3 text-sm focus:outline-none focus:border-text-primary transition-colors resize-y"
    />
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="mb-5">{children}</div>;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="border-t border-border pt-6 mt-6 mb-4">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest Pending
// ---------------------------------------------------------------------------

function GuestPendingForm({ content, onChange }: { content: AllEmailContent['guest_pending']; onChange: (field: string, value: unknown) => void }) {
  return (
    <>
      <FieldGroup>
        <FieldLabel label="Subject" />
        <TextInput value={content.subject} onChange={(v) => onChange('subject', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Body" hint="Main message to the guest after booking" />
        <TextArea value={content.body} onChange={(v) => onChange('body', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Footer" hint="Shown below the booking details" />
        <TextInput value={content.footer} onChange={(v) => onChange('footer', v)} />
      </FieldGroup>
    </>
  );
}

// ---------------------------------------------------------------------------
// Owner Approval
// ---------------------------------------------------------------------------

function OwnerApprovalForm({ content, onChange }: { content: AllEmailContent['owner_approval']; onChange: (field: string, value: unknown) => void }) {
  return (
    <>
      <FieldGroup>
        <FieldLabel label="Subject Template" hint="Use {guest_name} and {check_in} as placeholders" />
        <TextInput value={content.subject_template} onChange={(v) => onChange('subject_template', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Authorization Note" hint="Explains the payment hold to the owner" />
        <TextArea value={content.auth_note} onChange={(v) => onChange('auth_note', v)} />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup>
          <FieldLabel label="Approve Button" />
          <TextInput value={content.approve_label} onChange={(v) => onChange('approve_label', v)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="Decline Button" />
          <TextInput value={content.decline_label} onChange={(v) => onChange('decline_label', v)} />
        </FieldGroup>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Guest Confirmed
// ---------------------------------------------------------------------------

function GuestConfirmedForm({ content, onChange }: { content: AllEmailContent['guest_confirmed']; onChange: (field: string, value: unknown) => void }) {
  return (
    <>
      <FieldGroup>
        <FieldLabel label="Subject" />
        <TextInput value={content.subject} onChange={(v) => onChange('subject', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Body" hint="Main confirmation message" />
        <TextArea value={content.body} onChange={(v) => onChange('body', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="What's Next" hint="Tells guest about upcoming check-in email" />
        <TextArea value={content.whats_next} onChange={(v) => onChange('whats_next', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Footer" />
        <TextInput value={content.footer} onChange={(v) => onChange('footer', v)} />
      </FieldGroup>
    </>
  );
}

// ---------------------------------------------------------------------------
// Guest Declined
// ---------------------------------------------------------------------------

function GuestDeclinedForm({ content, onChange }: { content: AllEmailContent['guest_declined']; onChange: (field: string, value: unknown) => void }) {
  return (
    <>
      <FieldGroup>
        <FieldLabel label="Subject" />
        <TextInput value={content.subject} onChange={(v) => onChange('subject', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Body" hint="Use {dates} as a placeholder for the booking dates" />
        <TextArea value={content.body} onChange={(v) => onChange('body', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Secondary" hint="Follow-up message encouraging rebooking" />
        <TextArea value={content.secondary} onChange={(v) => onChange('secondary', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="CTA Button Text" />
        <TextInput value={content.cta_text} onChange={(v) => onChange('cta_text', v)} />
      </FieldGroup>
    </>
  );
}

// ---------------------------------------------------------------------------
// Check-in Instructions
// ---------------------------------------------------------------------------

function CheckinForm({ content, onChange }: { content: AllEmailContent['checkin']; onChange: (field: string, value: unknown) => void }) {
  function updateEntryStep(index: number, field: 'label' | 'detail', value: string) {
    const steps = [...content.entry_steps];
    steps[index] = { ...steps[index], [field]: value };
    onChange('entry_steps', steps);
  }

  function addEntryStep() {
    onChange('entry_steps', [...content.entry_steps, { label: '', detail: '' }]);
  }

  function removeEntryStep(index: number) {
    onChange('entry_steps', content.entry_steps.filter((_, i) => i !== index));
  }

  function updateListItem(field: 'tips' | 'checkout_reminders', index: number, value: string) {
    const list = [...content[field]];
    list[index] = value;
    onChange(field, list);
  }

  function addListItem(field: 'tips' | 'checkout_reminders') {
    onChange(field, [...content[field], '']);
  }

  function removeListItem(field: 'tips' | 'checkout_reminders', index: number) {
    onChange(field, content[field].filter((_, i) => i !== index));
  }

  return (
    <>
      <FieldGroup>
        <FieldLabel label="Subject" />
        <TextInput value={content.subject} onChange={(v) => onChange('subject', v)} />
      </FieldGroup>

      <SectionDivider label="Address" />
      <div className="grid md:grid-cols-2 gap-4">
        <FieldGroup>
          <FieldLabel label="Street Address" />
          <TextInput value={content.address} onChange={(v) => onChange('address', v)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="City, State, ZIP" />
          <TextInput value={content.city_state_zip} onChange={(v) => onChange('city_state_zip', v)} />
        </FieldGroup>
      </div>
      <FieldGroup>
        <FieldLabel label="Address Note" hint="e.g. 'We're at the corner of 18th & Valencia'" />
        <TextInput value={content.address_note} onChange={(v) => onChange('address_note', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Google Maps URL" />
        <TextInput value={content.maps_url} onChange={(v) => onChange('maps_url', v)} />
      </FieldGroup>

      <SectionDivider label="Entry Instructions" />
      {content.entry_steps.map((step, i) => (
        <div key={i} className="flex gap-3 mb-3 items-start">
          <span className="text-sm text-text-secondary mt-3 w-6 shrink-0">{i + 1}.</span>
          <div className="flex-1 grid md:grid-cols-[200px_1fr] gap-2">
            <input
              type="text"
              value={step.label}
              onChange={(e) => updateEntryStep(i, 'label', e.target.value)}
              placeholder="Label"
              className="border border-border bg-white p-2.5 text-sm focus:outline-none focus:border-text-primary"
            />
            <input
              type="text"
              value={step.detail}
              onChange={(e) => updateEntryStep(i, 'detail', e.target.value)}
              placeholder="Detail"
              className="border border-border bg-white p-2.5 text-sm focus:outline-none focus:border-text-primary"
            />
          </div>
          <button onClick={() => removeEntryStep(i)} className="text-red-500 hover:text-red-700 text-sm mt-2.5 shrink-0">&times;</button>
        </div>
      ))}
      <button onClick={addEntryStep} className="text-sm text-text-secondary hover:text-text-primary transition-colors">+ Add step</button>

      <SectionDivider label="Key Warning" />
      <FieldGroup>
        <FieldLabel label="Warning Message" />
        <TextArea value={content.key_warning} onChange={(v) => onChange('key_warning', v)} />
      </FieldGroup>
      <FieldGroup>
        <FieldLabel label="Lost Key Fee" />
        <TextInput value={content.lost_key_fee} onChange={(v) => onChange('lost_key_fee', v)} />
      </FieldGroup>

      <SectionDivider label="WiFi" />
      <div className="grid md:grid-cols-2 gap-4">
        <FieldGroup>
          <FieldLabel label="Network Name" />
          <TextInput value={content.wifi_network} onChange={(v) => onChange('wifi_network', v)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="Password" />
          <TextInput value={content.wifi_password} onChange={(v) => onChange('wifi_password', v)} />
        </FieldGroup>
      </div>

      <SectionDivider label="Tips (While You're Here)" />
      {content.tips.map((tip, i) => (
        <div key={i} className="flex gap-3 mb-2">
          <input
            type="text"
            value={tip}
            onChange={(e) => updateListItem('tips', i, e.target.value)}
            className="flex-1 border border-border bg-white p-2.5 text-sm focus:outline-none focus:border-text-primary"
          />
          <button onClick={() => removeListItem('tips', i)} className="text-red-500 hover:text-red-700 text-sm shrink-0">&times;</button>
        </div>
      ))}
      <button onClick={() => addListItem('tips')} className="text-sm text-text-secondary hover:text-text-primary transition-colors">+ Add tip</button>

      <SectionDivider label="Checkout Reminders" />
      {content.checkout_reminders.map((item, i) => (
        <div key={i} className="flex gap-3 mb-2">
          <input
            type="text"
            value={item}
            onChange={(e) => updateListItem('checkout_reminders', i, e.target.value)}
            className="flex-1 border border-border bg-white p-2.5 text-sm focus:outline-none focus:border-text-primary"
          />
          <button onClick={() => removeListItem('checkout_reminders', i)} className="text-red-500 hover:text-red-700 text-sm shrink-0">&times;</button>
        </div>
      ))}
      <button onClick={() => addListItem('checkout_reminders')} className="text-sm text-text-secondary hover:text-text-primary transition-colors">+ Add reminder</button>

      <SectionDivider label="Emergency Contact" />
      <div className="grid md:grid-cols-2 gap-4">
        <FieldGroup>
          <FieldLabel label="Name" />
          <TextInput value={content.emergency_name} onChange={(v) => onChange('emergency_name', v)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="Role" />
          <TextInput value={content.emergency_role} onChange={(v) => onChange('emergency_role', v)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="Email" />
          <TextInput value={content.emergency_email} onChange={(v) => onChange('emergency_email', v)} />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel label="Phone" />
          <TextInput value={content.emergency_phone} onChange={(v) => onChange('emergency_phone', v)} />
        </FieldGroup>
      </div>
    </>
  );
}
