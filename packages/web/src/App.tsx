import { useEffect, useState } from 'react';

type User = { id: string; name: string; email: string };
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    new URLSearchParams(window.location.search).has('error')
      ? 'Sign-in did not complete. Please try again.'
      : '',
  );
  useEffect(() => {
    fetch('/api/me')
      .then(async (response) => {
        if (response.status === 401) return;
        if (!response.ok) throw new Error('Could not check your session.');
        const data = (await response.json()) as { user: User };
        setUser(data.user);
      })
      .catch(() => setError('Could not check your session. Reload to try again.'))
      .finally(() => setLoading(false));
  }, []);
  async function submit(action: 'sign-in' | 'sign-out') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/auth/${action === 'sign-in' ? 'sign-in/oauth2' : 'sign-out'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            action === 'sign-in'
              ? { providerId: 'auth-pior', callbackURL: '/', errorCallbackURL: '/?error=sign-in' }
              : {},
          ),
        },
      );
      if (!response.ok) throw new Error('Request failed');
      if (action === 'sign-out') setUser(null);
      else {
        const data = (await response.json()) as { url?: string };
        if (!data.url) throw new Error('Missing sign-in redirect');
        window.location.assign(data.url);
      }
    } catch {
      setError(
        action === 'sign-in'
          ? 'Could not start sign-in. Please try again.'
          : 'Could not sign out. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full space-y-6 rounded-xl border p-6">
        <p className="text-sm opacity-70">Pior Labs</p>
        <h1 className="text-3xl font-semibold">Szarans Assistant</h1>
        {loading ? (
          <p role="status">Checking your session…</p>
        ) : user ? (
          <>
            <p>
              Signed in as <strong>{user.name}</strong>
            </p>
            <p className="break-all">{user.email}</p>
            <button
              className="rounded-md border px-4 py-2"
              disabled={busy}
              onClick={() => void submit('sign-out')}
            >
              Sign out
            </button>
            <p className="text-sm opacity-70">
              Sign-out ends this application session. Your central Pior Labs session stays signed
              in.
            </p>
          </>
        ) : (
          <>
            <p>Sign in with your household Pior Labs account.</p>
            <button
              className="rounded-md border px-4 py-2"
              disabled={busy}
              onClick={() => void submit('sign-in')}
            >
              Sign in with Pior Labs
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
