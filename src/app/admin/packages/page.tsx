'use client';

import { useState, useEffect, useCallback } from 'react';

type Tryout = { id: string; title: string; category: string };
type PackageCategory = {
    id: string;
    name: string;
    tryouts: Tryout[];
};
type Student = { id: string; name: string; username: string };

export default function PackagesPage() {
    const [categories, setCategories] = useState<PackageCategory[]>([]);
    const [allTryouts, setAllTryouts] = useState<Tryout[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);

    // Category form
    const [showCatForm, setShowCatForm] = useState(false);
    const [catName, setCatName] = useState('');
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Assign form
    const [assignCatId, setAssignCatId] = useState<string | null>(null);
    const [assignStudentId, setAssignStudentId] = useState('');
    const [assignResult, setAssignResult] = useState('');

    // Add tryout form
    const [addTryoutCatId, setAddTryoutCatId] = useState<string | null>(null);
    const [selectedTryoutId, setSelectedTryoutId] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [catRes, tryRes, stuRes] = await Promise.all([
            fetch('/api/admin/packages'),
            fetch('/api/admin/packages/tryouts-list'),
            fetch('/api/admin/students'),
        ]);
        setCategories(await catRes.json());

        // tryouts-list may not exist, use tryout list from another endpoint
        try {
            const tryData = await tryRes.json();
            setAllTryouts(Array.isArray(tryData) ? tryData : []);
        } catch {
            setAllTryouts([]);
        }

        setStudents(await stuRes.json());
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveCat = async () => {
        if (!catName.trim()) return;
        setSaving(true);

        const method = editingCatId ? 'PUT' : 'POST';
        const body = editingCatId ? { id: editingCatId, name: catName } : { name: catName };

        await fetch('/api/admin/packages', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        setCatName('');
        setEditingCatId(null);
        setShowCatForm(false);
        setSaving(false);
        await fetchData();
    };

    const handleDeleteCat = async (id: string, name: string) => {
        if (!confirm(`Hapus kategori "${name}"? Tryout di dalamnya tidak akan dihapus.`)) return;

        await fetch('/api/admin/packages', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });

        await fetchData();
    };

    const handleAddTryout = async (catId: string) => {
        if (!selectedTryoutId) return;
        await fetch('/api/admin/packages/tryouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tryoutId: selectedTryoutId, categoryId: catId }),
        });
        setSelectedTryoutId('');
        setAddTryoutCatId(null);
        await fetchData();
    };

    const handleRemoveTryout = async (tryoutId: string) => {
        await fetch('/api/admin/packages/tryouts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tryoutId }),
        });
        await fetchData();
    };

    const handleBulkAssign = async (catId: string) => {
        if (!assignStudentId) return;
        setAssignResult('');

        const res = await fetch('/api/admin/packages/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: catId, studentId: assignStudentId }),
        });

        const data = await res.json();
        setAssignResult(data.message || data.error || 'Selesai');
        setAssignStudentId('');
        setTimeout(() => setAssignResult(''), 4000);
    };

    // Get tryouts not yet assigned to any category
    const assignedTryoutIds = new Set(categories.flatMap(c => c.tryouts.map(t => t.id)));
    const unassignedTryouts = allTryouts.filter(t => !assignedTryoutIds.has(t.id));

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header"><h1>Paket Soal</h1></div>
                <div className="empty-state">Memuat data...</div>
            </div>
        );
    }

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="page-header" style={{ marginBottom: 0 }}>
                    <h1>📦 Paket Soal</h1>
                    <p>Kelola kategori paket soal dan assign ke siswa sekaligus.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setCatName(''); setEditingCatId(null); setShowCatForm(true); }}>
                    + Tambah Kategori
                </button>
            </div>

            {assignResult && (
                <div style={{ padding: '0.625rem 1rem', borderRadius: '8px', background: 'var(--success-light)', color: 'var(--success)', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    ✓ {assignResult}
                </div>
            )}

            {/* Category Create/Edit Form */}
            {showCatForm && (
                <div className="card" style={{ marginBottom: '1.5rem', maxWidth: '400px', border: '2px solid var(--primary-light)' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        {editingCatId ? '✏️ Edit Kategori' : '➕ Tambah Kategori Baru'}
                    </h2>
                    <div className="form-group">
                        <label className="form-label">Nama Kategori</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Contoh: Kelas 11, Kelas 12, UTBK"
                            value={catName}
                            onChange={e => setCatName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleSaveCat} disabled={saving}>
                            {saving ? '...' : 'Simpan'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setShowCatForm(false)}>Batal</button>
                    </div>
                </div>
            )}

            {/* Category List */}
            {categories.length === 0 ? (
                <div className="empty-state">
                    Belum ada kategori paket soal. Buat kategori untuk mengelompokkan tryout.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {categories.map(cat => (
                        <div key={cat.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        📁 {cat.name}
                                        <span className="badge badge-primary">{cat.tryouts.length} paket</span>
                                    </h2>
                                </div>
                                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                        setCatName(cat.name);
                                        setEditingCatId(cat.id);
                                        setShowCatForm(true);
                                    }}>Edit</button>
                                    <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }} onClick={() => handleDeleteCat(cat.id, cat.name)}>Hapus</button>
                                    <button className="btn btn-sm" style={{ background: 'var(--success-light)', color: 'var(--success)' }} onClick={() => setAssignCatId(assignCatId === cat.id ? null : cat.id)}>
                                        🎯 Assign Semua
                                    </button>
                                    <button className="btn btn-outline btn-sm" onClick={() => setAddTryoutCatId(addTryoutCatId === cat.id ? null : cat.id)}>
                                        + Tambah Tryout
                                    </button>
                                </div>
                            </div>

                            {/* Bulk Assign Form */}
                            {assignCatId === cat.id && (
                                <div style={{ padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '8px', marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span className="text-sm font-semibold">Assign semua {cat.tryouts.length} paket ke:</span>
                                    <select className="form-input" style={{ width: 'auto', minWidth: '200px' }} value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)}>
                                        <option value="">-- Pilih Siswa --</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} (@{s.username})</option>
                                        ))}
                                    </select>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleBulkAssign(cat.id)} disabled={!assignStudentId}>
                                        Assign Sekarang
                                    </button>
                                </div>
                            )}

                            {/* Add Tryout Form */}
                            {addTryoutCatId === cat.id && (
                                <div style={{ padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '8px', marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span className="text-sm font-semibold">Tambah tryout:</span>
                                    <select className="form-input" style={{ width: 'auto', minWidth: '200px' }} value={selectedTryoutId} onChange={e => setSelectedTryoutId(e.target.value)}>
                                        <option value="">-- Pilih Tryout --</option>
                                        {unassignedTryouts.map(t => (
                                            <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                                        ))}
                                    </select>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleAddTryout(cat.id)} disabled={!selectedTryoutId}>
                                        Tambah
                                    </button>
                                </div>
                            )}

                            {/* Tryout list in this category */}
                            {cat.tryouts.length === 0 ? (
                                <div className="text-muted text-sm" style={{ padding: '0.5rem 0' }}>Belum ada tryout di kategori ini.</div>
                            ) : (
                                <div className="table-wrap">
                                    <table style={{ fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr>
                                                <th>Paket Tryout</th>
                                                <th>Jenis</th>
                                                <th style={{ textAlign: 'right' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cat.tryouts.map(t => (
                                                <tr key={t.id}>
                                                    <td style={{ fontWeight: 500 }}>{t.title}</td>
                                                    <td><span className="badge badge-muted">{t.category}</span></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }} onClick={() => handleRemoveTryout(t.id)}>
                                                            Keluarkan
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
