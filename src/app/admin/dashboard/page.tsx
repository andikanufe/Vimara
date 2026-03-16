import { db as adminDb } from '@/lib/firebase-admin';
import Link from 'next/link';

export default async function AdminDashboard() {
  // Collection counts using aggregations (efficient)
  const studentsCountSnap = await adminDb.collection('users').where('role', '==', 'STUDENT').count().get();
  const studentCount = studentsCountSnap.data().count;

  const tryoutsSnap = await adminDb.collection('tryouts').count().get();
  const tryoutCount = tryoutsSnap.data().count;

  const questionsSnap = await adminDb.collection('questions').count().get();
  const questionCount = questionsSnap.data().count;

  const assignmentsSnap = await adminDb.collection('assignments').count().get();
  const assignmentCount = assignmentsSnap.data().count;

  const answersSnap = await adminDb.collection('answers').count().get();
  const answerCount = answersSnap.data().count;

  const totalDocs = studentCount + tryoutCount + questionCount + assignmentCount + answerCount;

  // AI Usage Tracking
  const aiUsageSnap = await adminDb.collection('metadata').doc('ai_usage').get();
  const aiUsageData = aiUsageSnap.exists ? aiUsageSnap.data() : { totalGenerations: 0 };
  const totalAiGen = aiUsageData?.totalGenerations || 0;

  // Firebase Spark Plan Limits (Estimations)
  const STORAGE_LIMIT_GB = 1;
  const ESTIMATED_STORAGE_USED_GB = (totalDocs * 0.0000012); // Rough estimate: 1.2KB per doc avg
  const storagePercentage = Math.min((ESTIMATED_STORAGE_USED_GB / STORAGE_LIMIT_GB) * 100, 100);

  const READ_LIMIT_DAILY = 50000;
  const WRITE_LIMIT_DAILY = 20000;

  const recentTryoutsQuery = await adminDb.collection('tryouts')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  const recentTryouts = recentTryoutsQuery.docs.map((doc: any) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || 'Untitled',
      category: data.category || 'Uncategorized',
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    };
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Dashboard Overview</h1>
        <p className="text-muted">Selamat datang kembali, Admin.</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
        <div className="card stat-card" style={{ borderLeftColor: 'var(--primary)' }}>
          <div className="stat-label">Total Tryout</div>
          <div className="stat-value">{tryoutCount}</div>
        </div>
        <div className="card stat-card" style={{ borderLeftColor: 'var(--success)' }}>
          <div className="stat-label">Total Siswa</div>
          <div className="stat-value">{studentCount}</div>
        </div>
        <div className="card stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="stat-label">Total Penugasan</div>
          <div className="stat-value">{assignmentCount}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '2rem', alignItems: 'flex-start' }}>
        {/* Monitoring Database Section */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Monitoring Database (Spark Plan)</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                <span style={{ fontWeight: 600 }}>Estimasi Storage (DOCS)</span>
                <span style={{ color: storagePercentage > 80 ? 'var(--error)' : 'var(--primary)' }}>
                  {ESTIMATED_STORAGE_USED_GB.toFixed(4)} GB / {STORAGE_LIMIT_GB} GB
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${storagePercentage}%`,
                  backgroundColor: storagePercentage > 80 ? 'var(--error)' : 'var(--primary)',
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                *Estimasi penggunaan berdasarkan total {totalDocs.toLocaleString()} dokumen Firestore.
              </p>
            </div>

            <div className="grid grid-3" style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Pertanyaan</div>
                <div style={{ fontWeight: 700 }}>{questionCount} <small style={{ fontWeight: 400 }}>docs</small></div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Jawaban</div>
                <div style={{ fontWeight: 700 }}>{answerCount} <small style={{ fontWeight: 400 }}>docs</small></div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginBottom: '0.25rem' }}>Total AI Generate</div>
                <div style={{ fontWeight: 700, color: '#0369a1' }}>{totalAiGen} <small style={{ fontWeight: 400 }}>times</small></div>
              </div>
            </div>

            <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#fff7ed', borderRadius: '8px', border: '1px solid #ffedd5', fontSize: '0.8rem', color: '#9a3412' }}>
              <strong>💡 Tips Spark Plan:</strong> Batas harian adalah 50rb Read & 20rb Write. Hindari refresh dashboard berlebihan.
            </div>
          </div>
        </div>

        {/* Recent Tryouts section simplified */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Tryout Terbaru</h2>
            <Link href="/admin/tryouts" className="btn btn-primary btn-sm">Ganti</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentTryouts.map((tryout: any) => (
              <div key={tryout.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tryout.title}</div>
                  <div className="text-muted text-xs">{tryout.category} • {new Date(tryout.createdAt).toLocaleDateString('id-ID')}</div>
                </div>
                <Link href={`/admin/tryouts/${tryout.id}`} className="text-primary text-xs font-semibold">Detail</Link>
              </div>
            ))}
            {recentTryouts.length === 0 && <p className="text-center text-muted text-sm py-4">Belum ada tryout</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
