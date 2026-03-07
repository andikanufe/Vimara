'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }

      router.push(data.redirect);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="landing-bg">
      {/* Animated Floating Shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>

      <div className="glass-container animate-in">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="logo-icon">
            <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h1 className="landing-title">Tryout Platform</h1>
          <p className="landing-subtitle">
            Persiapkan masa depanmu dari sekarang
          </p>
        </div>

        {error && (
          <div className="glass-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="landing-form">
          <div className="form-group glass-input-group">
            <label className="form-label text-white" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="form-input glass-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group glass-input-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label text-white" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary glass-btn"
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk ke Portal'}
          </button>
        </form>
      </div>
    </main>
  );
}
