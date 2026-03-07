'use client';

import { useState } from 'react';

export default function StudentSettingsPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('Konfirmasi password tidak cocok');
            return;
        }

        if (password.length < 4) {
            setError('Password harus minimal 4 karakter');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/student/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Gagal mengubah password');
            }

            setSuccess('Password berhasil diperbarui!');
            setPassword('');
            setConfirmPassword('');
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else setError('Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>⚙️ Pengaturan Akun</h1>
                <p>Kelola profil dan keamanan akun Anda.</p>
            </div>

            <div className="card" style={{ maxWidth: '400px' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Ubah Password</h2>

                {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{ padding: '0.75rem', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        ✓ {success}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Sandi Baru</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Masukkan sandi baru"
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label" htmlFor="confirmPassword">Konfirmasi Sandi Baru</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Ketik ulang sandi baru"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? 'Menyimpan...' : 'Simpan Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
