'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUI } from '@/providers/UIProvider';

type Student = {
    id: string;
    username: string;
    name: string;
    password: string;
    createdAt: string;
    _count: { assignments: number };
};

type Assignment = {
    id: string;
    tryoutId: string;
    status: string;
    score: number | null;
    tryout: {
        id: string;
        title: string;
        category: string;
        packageCategory: { id: string; name: string } | null;
    };
};

type StudentDetail = Student & { assignments: Assignment[] };

type Tryout = { id: string; title: string; category: string; categoryId: string | null };
type PackageCategory = { id: string; name: string; tryouts: { id: string; title: string }[] };

export default function ManageStudentsPage() {
    const { confirm, alert, toast } = useUI();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ username: '', password: '', name: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Assignment panel state
    const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
    const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
    const [allTryouts, setAllTryouts] = useState<Tryout[]>([]);
    const [allCategories, setAllCategories] = useState<PackageCategory[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [assignMode, setAssignMode] = useState<'tryout' | 'package'>('tryout');
    const [selectedTryoutIds, setSelectedTryoutIds] = useState<string[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [assignMsg, setAssignMsg] = useState('');

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/students');
            if (res.ok) {
                const data = await res.json();
                setStudents(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Fetch students error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    const fetchStudentDetail = async (studentId: string) => {
        setLoadingDetail(true);
        const [detailRes, tryoutsRes, catsRes] = await Promise.all([
            fetch(`/api/admin/students/${studentId}`),
            fetch('/api/admin/packages/tryouts-list'),
            fetch('/api/admin/packages'),
        ]);
        const detail = await detailRes.json();
        setStudentDetail(detail);

        try {
            setAllTryouts(await tryoutsRes.json());
        } catch { setAllTryouts([]); }

        try {
            setAllCategories(await catsRes.json());
        } catch { setAllCategories([]); }

        setLoadingDetail(false);
    };

    const toggleExpand = async (studentId: string) => {
        if (expandedStudentId === studentId) {
            setExpandedStudentId(null);
            setStudentDetail(null);
            return;
        }
        setExpandedStudentId(studentId);
        setAssignMsg('');
        setSelectedTryoutIds([]);
        setSelectedCategoryId('');
        await fetchStudentDetail(studentId);
    };

    const refreshDetail = async () => {
        if (expandedStudentId) await fetchStudentDetail(expandedStudentId);
        await fetchStudents();
    };

    const resetForm = () => {
        setFormData({ username: '', password: '', name: '' });
        setEditingId(null);
        setShowForm(false);
        setError('');
    };

    const handleSave = async () => {
        if (!formData.username || !formData.name) {
            setError('Username dan nama wajib diisi');
            return;
        }
        if (!editingId && !formData.password) {
            setError('Password wajib diisi untuk siswa baru');
            return;
        }

        setSaving(true);
        setError('');

        const method = editingId ? 'PUT' : 'POST';
        const body = editingId ? { id: editingId, ...formData } : formData;

        const res = await fetch('/api/admin/students', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const data = await res.json();
            setError(data.error || 'Terjadi kesalahan');
            setSaving(false);
            return;
        }

        await fetchStudents();
        resetForm();
        setSaving(false);
    };

    const handleEdit = (student: Student) => {
        setFormData({ username: student.username, password: '', name: student.name });
        setEditingId(student.id);
        setShowForm(true);
        setError('');
    };

    const handleDelete = async (id: string, name: string) => {
        const ok = await confirm('Hapus Siswa?', `Hapus siswa "${name}"? Semua data tryout siswa ini akan dihapus permanen.`, 'danger');
        if (!ok) return;

        await fetch('/api/admin/students', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });

        if (expandedStudentId === id) {
            setExpandedStudentId(null);
            setStudentDetail(null);
        }
        await fetchStudents();
    };

    // --- Assignment Actions ---
    const handleAssignTryouts = async () => {
        if (!expandedStudentId || selectedTryoutIds.length === 0) return;

        const res = await fetch(`/api/admin/students/${expandedStudentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tryoutIds: selectedTryoutIds }),
        });
        const data = await res.json();
        setAssignMsg(data.message || 'Berhasil');
        setSelectedTryoutIds([]);
        await refreshDetail();
        setTimeout(() => setAssignMsg(''), 3000);
    };

    const handleAssignPackage = async () => {
        if (!expandedStudentId || !selectedCategoryId) return;

        const res = await fetch(`/api/admin/students/${expandedStudentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: selectedCategoryId }),
        });
        const data = await res.json();
        setAssignMsg(data.message || 'Berhasil');
        setSelectedCategoryId('');
        await refreshDetail();
        setTimeout(() => setAssignMsg(''), 3000);
    };

    const handleRemoveAssignment = async (assignmentId: string) => {
        if (!expandedStudentId) return;
        const ok = await confirm('Hapus Penugasan?', 'Apakah Anda yakin ingin menghapus penugasan ini?', 'danger');
        if (!ok) return;

        await fetch(`/api/admin/students/${expandedStudentId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignmentIds: [assignmentId] }),
        });
        await refreshDetail();
    };

    const handleRemovePackage = async (catId: string, catName: string) => {
        if (!expandedStudentId) return;
        const ok = await confirm('Hapus Paket?', `Hapus semua penugasan paket "${catName}" dari siswa ini? Hanya penugasan berstatus PENDING yang akan dihapus.`, 'danger');
        if (!ok) return;

        await fetch(`/api/admin/students/${expandedStudentId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: catId }),
        });
        await refreshDetail();
    };

    const filtered = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get tryouts not yet assigned to this student
    const assignedTryoutIds = studentDetail ? new Set(studentDetail.assignments.map(a => a.tryoutId)) : new Set<string>();
    const availableTryouts = allTryouts.filter(t => !assignedTryoutIds.has(t.id));

    // Group student's assignments by package category
    const groupedAssignments = () => {
        if (!studentDetail) return { ungrouped: [], grouped: new Map<string, { name: string; assignments: Assignment[] }>() };

        const grouped = new Map<string, { name: string; assignments: Assignment[] }>();
        const ungrouped: Assignment[] = [];

        for (const a of studentDetail.assignments) {
            const pkg = a.tryout.packageCategory;
            if (pkg) {
                if (!grouped.has(pkg.id)) {
                    grouped.set(pkg.id, { name: pkg.name, assignments: [] });
                }
                grouped.get(pkg.id)!.assignments.push(a);
            } else {
                ungrouped.push(a);
            }
        }

        return { ungrouped, grouped };
    };

    const toggleTryoutSelection = (id: string) => {
        setSelectedTryoutIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="page-header" style={{ marginBottom: 0 }}>
                    <h1>Kelola Siswa</h1>
                    <p>Kelola akun siswa dan assign tryout/paket soal.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Tambah Siswa
                </button>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: '1.5rem', maxWidth: '500px', border: '2px solid var(--primary-light)' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>
                        {editingId ? '✏️ Edit Siswa' : '➕ Tambah Siswa Baru'}
                    </h2>

                    {error && (
                        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Nama Lengkap</label>
                        <input type="text" className="form-input" placeholder="Contoh: Ahmad Fauzi" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Username (User ID)</label>
                        <input type="text" className="form-input" placeholder="Contoh: ahmad.fauzi" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password {editingId && <span className="text-muted text-xs">(kosongkan jika tidak diubah)</span>}</label>
                        <input type="text" className="form-input" placeholder={editingId ? 'Kosongkan jika tidak diubah' : 'Password siswa'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Siswa'}
                        </button>
                        <button className="btn btn-outline" onClick={resetForm}>Batal</button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: '1rem', maxWidth: '320px' }}>
                <input type="text" className="form-input" placeholder="🔍 Cari siswa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            {/* Students List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading ? (
                    <div className="empty-state">Memuat data...</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">{searchQuery ? 'Tidak ada siswa ditemukan.' : 'Belum ada siswa terdaftar.'}</div>
                ) : (
                    filtered.map(student => {
                        const isExpanded = expandedStudentId === student.id;

                        return (
                            <div key={student.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* Student Row */}
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1.25rem', gap: '1rem', flexWrap: 'wrap', cursor: 'pointer', background: isExpanded ? 'var(--primary-light)' : undefined }}
                                    onClick={() => toggleExpand(student.id)}>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{student.name}</div>
                                        <div className="text-muted text-sm">@{student.username}</div>
                                    </div>
                                    <code style={{ fontSize: '0.75rem', background: 'var(--bg-color)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        {student.password.startsWith('$2') ? '********' : student.password}
                                    </code>
                                    <span className="badge badge-primary">{student._count.assignments} tugas</span>
                                    <div style={{ display: 'flex', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(student)}>Edit</button>
                                        <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }} onClick={() => handleDelete(student.id, student.name)}>Hapus</button>
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                </div>

                                {/* Expanded Assignment Panel */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border-light)', padding: '1.25rem', background: 'var(--bg-color)' }}>
                                        {loadingDetail ? (
                                            <div className="text-muted text-sm" style={{ padding: '1rem', textAlign: 'center' }}>Memuat data penugasan...</div>
                                        ) : studentDetail ? (
                                            <>
                                                {/* Assign Section */}
                                                <div style={{ marginBottom: '1.25rem' }}>
                                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}>📋 Tugaskan Soal</h3>

                                                    {assignMsg && (
                                                        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--success-light)', color: 'var(--success)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                                                            ✓ {assignMsg}
                                                        </div>
                                                    )}

                                                    {/* Mode Toggle */}
                                                    <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
                                                        <button className={`btn btn-sm ${assignMode === 'tryout' ? 'btn-primary' : 'btn-outline'}`}
                                                            onClick={() => setAssignMode('tryout')}>
                                                            Per Tryout
                                                        </button>
                                                        <button className={`btn btn-sm ${assignMode === 'package' ? 'btn-primary' : 'btn-outline'}`}
                                                            onClick={() => setAssignMode('package')}>
                                                            Per Paket
                                                        </button>
                                                    </div>

                                                    {assignMode === 'package' ? (
                                                        /* Package assign */
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                            <select className="form-input" style={{ width: 'auto', minWidth: '220px' }}
                                                                value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}>
                                                                <option value="">-- Pilih Paket Soal --</option>
                                                                {allCategories.map(cat => (
                                                                    <option key={cat.id} value={cat.id}>📦 {cat.name} ({cat.tryouts.length} tryout)</option>
                                                                ))}
                                                            </select>
                                                            <button className="btn btn-primary btn-sm" onClick={handleAssignPackage} disabled={!selectedCategoryId}>
                                                                Assign Semua Paket
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        /* Individual tryout assign */
                                                        <div>
                                                            {availableTryouts.length === 0 ? (
                                                                <div className="text-muted text-sm">Semua tryout sudah ditugaskan ke siswa ini.</div>
                                                            ) : (
                                                                <>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem', maxHeight: '140px', overflowY: 'auto', padding: '0.375rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                                        {availableTryouts.map(t => {
                                                                            const sel = selectedTryoutIds.includes(t.id);
                                                                            return (
                                                                                <button key={t.id}
                                                                                    className={`btn btn-sm ${sel ? 'btn-primary' : 'btn-outline'}`}
                                                                                    onClick={() => toggleTryoutSelection(t.id)}
                                                                                    style={{ fontSize: '0.75rem' }}>
                                                                                    {sel ? '✓ ' : ''}{t.title}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <button className="btn btn-primary btn-sm" onClick={handleAssignTryouts} disabled={selectedTryoutIds.length === 0}>
                                                                        Assign {selectedTryoutIds.length} Tryout
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Existing Assignments */}
                                                <div>
                                                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                                                        📝 Penugasan Saat Ini ({studentDetail.assignments.length})
                                                    </h3>

                                                    {studentDetail.assignments.length === 0 ? (
                                                        <div className="text-muted text-sm">Belum ada tryout ditugaskan.</div>
                                                    ) : (() => {
                                                        const { ungrouped, grouped } = groupedAssignments();
                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                {/* Grouped by package */}
                                                                {Array.from(grouped.entries()).map(([catId, { name, assignments }]) => (
                                                                    <div key={catId} style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', background: 'var(--primary-light)', borderBottom: '1px solid var(--border-light)' }}>
                                                                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>📦 {name} <span className="badge badge-primary" style={{ marginLeft: '0.375rem' }}>{assignments.length}</span></span>
                                                                            <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.6875rem' }}
                                                                                onClick={() => handleRemovePackage(catId, name)}>
                                                                                Hapus Paket
                                                                            </button>
                                                                        </div>
                                                                        <div className="table-wrap">
                                                                            <table style={{ fontSize: '0.8125rem' }}>
                                                                                <tbody>
                                                                                    {assignments.map(a => (
                                                                                        <tr key={a.id}>
                                                                                            <td style={{ fontWeight: 500, paddingLeft: '0.875rem' }}>{a.tryout.title}</td>
                                                                                            <td><span className="badge badge-muted">{a.tryout.category}</span></td>
                                                                                            <td>
                                                                                                <span className={`badge ${a.status === 'COMPLETED' ? 'badge-success' : a.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'}`}>
                                                                                                    {a.status}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td style={{ textAlign: 'right', fontWeight: 600, color: a.score !== null ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                                                                {a.score !== null ? a.score.toFixed(1) : '-'}
                                                                                            </td>
                                                                                            <td style={{ textAlign: 'right' }}>
                                                                                                {a.status === 'PENDING' && (
                                                                                                    <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.6875rem' }}
                                                                                                        onClick={() => handleRemoveAssignment(a.id)}>
                                                                                                        Hapus
                                                                                                    </button>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Ungrouped tryouts */}
                                                                {ungrouped.length > 0 && (
                                                                    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                                                        {grouped.size > 0 && (
                                                                            <div style={{ padding: '0.625rem 0.875rem', background: 'var(--bg-color)', borderBottom: '1px solid var(--border-light)' }}>
                                                                                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Tanpa Paket</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="table-wrap">
                                                                            <table style={{ fontSize: '0.8125rem' }}>
                                                                                <tbody>
                                                                                    {ungrouped.map(a => (
                                                                                        <tr key={a.id}>
                                                                                            <td style={{ fontWeight: 500, paddingLeft: '0.875rem' }}>{a.tryout.title}</td>
                                                                                            <td><span className="badge badge-muted">{a.tryout.category}</span></td>
                                                                                            <td>
                                                                                                <span className={`badge ${a.status === 'COMPLETED' ? 'badge-success' : a.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'}`}>
                                                                                                    {a.status}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td style={{ textAlign: 'right', fontWeight: 600, color: a.score !== null ? 'var(--primary)' : 'var(--text-muted)' }}>
                                                                                                {a.score !== null ? a.score.toFixed(1) : '-'}
                                                                                            </td>
                                                                                            <td style={{ textAlign: 'right' }}>
                                                                                                {a.status === 'PENDING' && (
                                                                                                    <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.6875rem' }}
                                                                                                        onClick={() => handleRemoveAssignment(a.id)}>
                                                                                                        Hapus
                                                                                                    </button>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {!loading && (
                <div className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
                    Total: {students.length} siswa
                </div>
            )}
        </div>
    );
}
