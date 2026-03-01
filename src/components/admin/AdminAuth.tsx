import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout } from '../layout/Layout';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { getAdminToken, setAdminToken, clearAdminToken } from '../../lib/adminFetch';

export function AdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAdminToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Re-check auth on mount (in case token was cleared)
  useEffect(() => {
    setIsAuthenticated(!!getAdminToken());
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let errorMsg = 'Login failed';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setAdminToken(data.token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  }

  function handleLogout() {
    clearAdminToken();
    setIsAuthenticated(false);
    navigate('/admin');
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <section className="py-16 md:py-24">
          <Container size="sm">
            <div className="max-w-sm mx-auto">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
                Admin
              </p>
              <h1 className="font-serif text-3xl text-text-primary mb-8 tracking-tight">
                Sign In
              </h1>

              {error && (
                <div className="p-3 mb-6 bg-red-50 text-red-800 border border-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-border bg-white p-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary transition-colors"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-border bg-white p-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-text-primary transition-colors"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={loading}>
                  Sign In
                </Button>
              </form>

              <p className="text-xs text-text-secondary mt-6 text-center">
                <a
                  href="mailto:dylan@dylandibona.com?subject=Studio%20Zero%20Admin%20Password%20Reset"
                  className="underline underline-offset-2 hover:text-text-primary transition-colors"
                >
                  Forgot password?
                </a>
              </p>
            </div>
          </Container>
        </section>
      </Layout>
    );
  }

  return <Outlet context={{ logout: handleLogout }} />;
}

export type AdminAuthContext = {
  logout: () => void;
};
