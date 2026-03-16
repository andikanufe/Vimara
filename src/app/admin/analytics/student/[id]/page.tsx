import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

export default async function StudentAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return redirect('/');

    const studentId = (await params).id;
    const sDoc = await db.collection('users').doc(studentId).get();
    if (!sDoc.exists) return notFound();

    const studentData = sDoc.data()!;

    // Get completed assignments
    const assignmentsSnap = await db.collection('assignments')
        .where('studentId', '==', studentId)
        .where('status', '==', 'COMPLETED')
        .get();

    const assignmentsUnsorted = await Promise.all(assignmentsSnap.docs.map(async (aDoc) => {
        const a = aDoc.data();
        const tryoutDoc = await db.collection('tryouts').doc(a.tryoutId).get();
        return {
            id: aDoc.id,
            ...a,
            tryout: tryoutDoc.exists ? tryoutDoc.data() : null
        } as any;
    }));

    // Sort by endTime descending in memory to avoid Firebase missing index errors
    const assignments = assignmentsUnsorted.sort((a, b) => {
        const tA = a.endTime?.toDate ? a.endTime.toDate().getTime() : (a.endTime ? new Date(a.endTime).getTime() : 0);
        const tB = b.endTime?.toDate ? b.endTime.toDate().getTime() : (b.endTime ? new Date(b.endTime).getTime() : 0);
        return tB - tA;
    });

    const scores = assignments.map(a => Number(a.score) || 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    return (
        <div className="animate-in">
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/admin/analytics?pov=student" className="back-link">← Kembali ke List Siswa</Link>
            </div>

            <div className="card" style={{ marginBottom: '2rem', padding: '2rem', borderTop: '8px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{studentData.name}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>@{studentData.username} • Siswa</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="stat-card" style={{ minWidth: '120px' }}>
                            <div className="text-xs text-muted font-bold">RATA-RATA</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{avgScore.toFixed(1)}</div>
                        </div>
                        <div className="stat-card" style={{ minWidth: '120px' }}>
                            <div className="text-xs text-muted font-bold">TERTINGGI</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{maxScore.toFixed(0)}</div>
                        </div>
                        <div className="stat-card" style={{ minWidth: '120px' }}>
                            <div className="text-xs text-muted font-bold">TOTAL UJIAN</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{assignments.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Riwayat Pengerjaan</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {assignments.map((a: any) => (
                    <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span className="badge badge-primary">{a.tryout?.category || 'Unknown'}</span>
                                <span className="text-xs text-muted">
                                    {a.endTime?.toDate ? a.endTime.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                                </span>
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{a.tryout?.title || 'Unknown Tryout'}</h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SKOR</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: Number(a.score) >= 70 ? 'var(--success)' : 'var(--primary)' }}>
                                    {Number(a.score).toFixed(1)}
                                </div>
                            </div>
                            <Link href={`/student/tryouts/${a.id}/result`} className="btn btn-outline btn-sm">
                                Review Jawaban →
                            </Link>
                        </div>
                    </div>
                ))}

                {assignments.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <p className="text-muted">Siswa ini belum menyelesaikan ujian apapun.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
