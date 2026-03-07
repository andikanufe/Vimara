'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const isTakeTryoutPage = pathname.includes('/take/');

  if (isTakeTryoutPage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
        {children}
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">📚 Siswa Portal</div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link
                href="/student/dashboard"
                className={pathname === '/student/dashboard' ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <span>🏠</span>
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/student/settings"
                className={pathname === '/student/settings' ? 'active' : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <span>⚙️</span>
                Pengaturan
              </Link>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Mobile Top Bar */}
        <div className="mobile-topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Siswa Portal</span>
          <div style={{ width: '40px' }} />
        </div>

        <div className="container" style={{ maxWidth: '900px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
