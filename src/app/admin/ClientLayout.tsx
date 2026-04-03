'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
    { name: 'Manajemen Latihan', path: '/admin/tryouts', icon: '📝' },
    { name: 'Import Soal', path: '/admin/import', icon: '📥' },
    { name: 'Paket Soal', path: '/admin/packages', icon: '📦' },
    { name: 'Analisis Soal', path: '/admin/analytics', icon: '📈' },
    { name: 'Kelola Siswa', path: '/admin/students/manage', icon: '👤' },
    { name: 'Data Siswa & Hasil', path: '/admin/students', icon: '👥' },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/vimara-logo.svg" alt="Vimara Logo" style={{ height: '32px' }} />
          <span>Admin Portal</span>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={isActive ? 'active' : ''}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span>{item.icon}</span>
                    {item.name}
                  </Link>
                </li>
              );
            })}
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
          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Admin Portal</span>
          <div style={{ width: '40px' }} />
        </div>

        <div className="container">
          {children}
        </div>
      </main>
    </div>
  );
}
