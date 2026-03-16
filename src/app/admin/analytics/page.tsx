import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import MathText from '@/components/MathText';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ pov?: string }> }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return redirect('/');

    const pov = (await searchParams).pov;

    if (!pov) {
        return (
            <div className="animate-in">
                <div className="page-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, var(--primary), var(--primary-dark))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Analisis Data & Statistik
                    </h1>
                    <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)' }}>Pilih sudut pandang analisis untuk memulai</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>
                    <Link href="/admin/analytics?pov=student" className="card hover-card" style={{ padding: '2.5rem', textAlign: 'center', textDecoration: 'none', transition: 'all 0.3s' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>👤</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Analisis per Siswa</h2>
                        <p className="text-muted">Lihat performa individu siswa, grafik nilai, dan progres belajar setiap murid secara detail.</p>
                        <div className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Pilih POV Siswa</div>
                    </Link>

                    <Link href="/admin/analytics?pov=package" className="card hover-card" style={{ padding: '2.5rem', textAlign: 'center', textDecoration: 'none', transition: 'all 0.3s' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📦</div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Analisis per Paket</h2>
                        <p className="text-muted">Lihat statistik butir soal, tingkat kesulitan, daya beda, dan distribusi jawaban per paket soal.</p>
                        <div className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Pilih POV Paket</div>
                    </Link>
                </div>
            </div>
        );
    }

    if (pov === 'package') {
        const tryoutsSnap = await db.collection('tryouts').orderBy('createdAt', 'desc').get();

        const tryouts = await Promise.all(tryoutsSnap.docs.map(async (tDoc) => {
            const tryoutId = tDoc.id;
            const assignmentsSnap = await db.collection('assignments')
                .where('tryoutId', '==', tryoutId)
                .where('status', '==', 'COMPLETED')
                .get();

            return {
                id: tryoutId,
                title: tDoc.data().title,
                category: tDoc.data().category,
                completedCount: assignmentsSnap.size,
                data: tDoc.data()
            };
        }));

        return (
            <div className="animate-in">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <Link href="/admin/analytics" className="back-link">← Ganti POV</Link>
                        <h1>📦 Analisis per Paket Soal</h1>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {tryouts.map(t => (
                        <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <span className="badge badge-primary">{t.category}</span>
                                    <span className="badge badge-muted">{t.completedCount} peserta</span>
                                </div>
                                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{t.title}</h2>
                            </div>
                            <Link href={`/admin/analytics/package/${t.id}`} className="btn btn-outline btn-sm">
                                Lihat Detail Analisis →
                            </Link>
                        </div>
                    ))}
                    {tryouts.length === 0 && <div className="empty-state">Belum ada data tryout.</div>}
                </div>
            </div>
        );
    }

    if (pov === 'student') {
        const studentsSnap = await db.collection('users').where('role', '==', 'STUDENT').get();
        const students = await Promise.all(studentsSnap.docs.map(async (sDoc) => {
            const assignmentsSnap = await db.collection('assignments')
                .where('studentId', '==', sDoc.id)
                .where('status', '==', 'COMPLETED')
                .get();
            
            const scores = assignmentsSnap.docs.map(d => Number(d.data().score) || 0);
            const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

            return {
                id: sDoc.id,
                name: sDoc.data().name,
                username: sDoc.data().username,
                completedCount: assignmentsSnap.size,
                avgScore: avg
            };
        }));

        return (
            <div className="animate-in">
                <div className="page-header">
                    <Link href="/admin/analytics" className="back-link">← Ganti POV</Link>
                    <h1>👤 Analisis per Siswa</h1>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '1.5rem' }}>Nama Siswa</th>
                                    <th>Username</th>
                                    <th style={{ textAlign: 'center' }}>Ujian Selesai</th>
                                    <th style={{ textAlign: 'center' }}>Rata-rata Nilai</th>
                                    <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ paddingLeft: '1.5rem', fontWeight: 600 }}>{s.name}</td>
                                        <td className="text-muted">@{s.username}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-primary">{s.completedCount}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontWeight: 700, color: s.avgScore >= 70 ? 'var(--success)' : 'var(--primary)' }}>
                                                {s.avgScore.toFixed(1)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                            <Link href={`/admin/analytics/student/${s.id}`} className="btn btn-outline btn-sm">
                                                Analisis Mendalam →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {students.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="empty-state">Belum ada data siswa.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
