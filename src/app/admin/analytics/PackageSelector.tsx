'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

export default function PackageSelector({ tryouts, selectedId }: { tryouts: { id: string, title: string }[], selectedId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = tryouts.find(t => t.id === selectedId);
    const filtered = query.trim() === ''
        ? tryouts
        : tryouts.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (id: string) => {
        setOpen(false);
        setQuery('');
        if (id !== selectedId) router.push(`/admin/analytics?packageId=${id}`);
    };

    const handleOpen = () => {
        setOpen(true);
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '220px' }}>
            {/* Trigger button */}
            <button
                onClick={handleOpen}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '8px 10px',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--surface, #fff)',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary, #111)',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected?.title || 'Pilih Paket...'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary, #888)', flexShrink: 0 }}>▼</span>
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    width: '320px',
                    backgroundColor: 'var(--surface, #fff)',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    zIndex: 999,
                    overflow: 'hidden',
                }}>
                    {/* Search input */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light, #f3f4f6)' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={`Cari dari ${tryouts.length} paket soal...`}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '1px solid var(--border, #e5e7eb)',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: 'var(--text-primary, #111)',
                                backgroundColor: 'var(--bg, #fafafa)',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Options list */}
                    <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                        {filtered.length > 0 ? (
                            filtered.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSelect(t.id)}
                                    style={{
                                        width: '100%',
                                        display: 'block',
                                        textAlign: 'left',
                                        padding: '9px 14px',
                                        fontSize: '13px',
                                        fontWeight: t.id === selectedId ? 600 : 400,
                                        color: t.id === selectedId ? 'var(--primary, #2563eb)' : 'var(--text-primary, #111)',
                                        backgroundColor: t.id === selectedId ? 'var(--surface-container, #eff4ff)' : 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-light, #fafafa)',
                                    }}
                                    onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'var(--border-light, #f9fafb)'; }}
                                    onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = t.id === selectedId ? 'var(--surface-container, #eff4ff)' : 'transparent'; }}
                                >
                                    {t.title}
                                </button>
                            ))
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary, #888)' }}>
                                Tidak ditemukan
                            </div>
                        )}
                    </div>

                    {tryouts.length > 10 && (
                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-light, #f3f4f6)', fontSize: '11px', color: 'var(--text-secondary, #999)' }}>
                            {filtered.length} dari {tryouts.length} paket
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
