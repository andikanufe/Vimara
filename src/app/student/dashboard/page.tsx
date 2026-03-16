import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StudentDashboard() {
  const session = await getSession();

  if (!session) return null;

  // 1. Fetch assignments for the student
  const assignmentsSnap = await db.collection('assignments')
    .where('studentId', '==', session.id)
    .get();

  // 2. Sort documents by creation date (in-memory to avoid index need)
  const sortedDocs = assignmentsSnap.docs.sort((a, b) => {
    const dateA = a.data().createdAt?.toDate?.() || new Date(0);
    const dateB = b.data().createdAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  // 3. Fetch all package categories map for grouping
  const categoriesSnap = await db.collection('packageCategories').get();
  const categoriesMap = new Map();
  categoriesSnap.docs.forEach(doc => {
    categoriesMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  // 4. Enrich assignments with tryout details and package categories
  const enrichedAssignments = await Promise.all(sortedDocs.map(async (doc) => {
    const aData = doc.data();
    const tryoutDoc = await db.collection('tryouts').doc(aData.tryoutId as string).get();

    if (!tryoutDoc.exists) return null;

    const tData = tryoutDoc.data()!;
    const categoryId = tData.categoryId;
    const packageCategory = categoryId ? categoriesMap.get(categoryId) : null;

    // Get question count
    const qSnap = await db.collection('questions').where('tryoutId', '==', tryoutDoc.id).count().get();
    const qCount = qSnap.data().count;

    return {
      id: doc.id,
      ...aData,
      tryout: {
        id: tryoutDoc.id,
        ...tData,
        packageCategory,
        _count: { questions: qCount }
      }
    };
  }));

  const validAssignments = enrichedAssignments.filter(Boolean);

  // 5. Grouping helper
  const groupAssignments = (list: any[]) => {
    const grouped = new Map<string, { id: string; name: string; assignments: any[] }>();
    const individual: any[] = [];

    list.forEach(a => {
      const pkg = a.tryout.packageCategory;
      if (pkg) {
        if (!grouped.has(pkg.id)) {
          grouped.set(pkg.id, { id: pkg.id, name: pkg.name, assignments: [] });
        }
        grouped.get(pkg.id)!.assignments.push(a);
      } else {
        individual.push(a);
      }
    });

    return {
      grouped: Array.from(grouped.values()),
      individual
    };
  };

  const pendingData = groupAssignments(validAssignments.filter((a: any) => a.status === 'PENDING' || a.status === 'ONGOING'));
  const completedAssignments = validAssignments.filter((a: any) => a.status === 'COMPLETED');

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Selamat Datang, {session.name} 👋</h1>
        <p>Ini adalah daftar paket tryout yang ditugaskan kepada Anda.</p>
      </div>

      {/* Active Assignments Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          📝 Daftar Tryout Aktif
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Grouped by Packages */}
          {pendingData.grouped.map((pkg) => (
            <div key={pkg.id} className="package-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.75rem' }}>📦</span>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary)' }}>{pkg.name}</h3>
                  <p className="text-muted text-xs">{pkg.assignments.length} Tryout di dalam paket ini</p>
                </div>
              </div>
              <div className="grid grid-auto" style={{ gap: '1rem' }}>
                {pkg.assignments.map((assignment: any) => renderAssignmentCard(assignment))}
              </div>
            </div>
          ))}

          {/* Individual Tryouts (No Package) */}
          {pendingData.individual.length > 0 && (
            <div className="package-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.75rem' }}>📄</span>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Tryout Mandiri</h3>
                  <p className="text-muted text-xs">Tryout yang ditugaskan secara individu</p>
                </div>
              </div>
              <div className="grid grid-auto" style={{ gap: '1rem' }}>
                {pendingData.individual.map((assignment: any) => renderAssignmentCard(assignment))}
              </div>
            </div>
          )}

          {pendingData.grouped.length === 0 && pendingData.individual.length === 0 && (
            <div className="empty-state">
              Tidak ada tugas tryout aktif saat ini.
            </div>
          )}
        </div>
      </div>

      {/* History Section */}
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-muted)' }}>Riwayat Pengerjaan</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {completedAssignments.map((assignment: any) => (
            <div key={assignment.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.875rem 1.25rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{assignment.tryout.title as string}</div>
                <div className="text-muted text-xs">
                  {assignment.tryout.packageCategory ? `📦 ${assignment.tryout.packageCategory.name} • ` : ''}
                  Selesai: {assignment.endTime ? assignment.endTime.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Skor</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>
                    {assignment.score?.toFixed(1) || '0'}
                  </div>
                </div>
                <Link href={`/student/tryouts/${assignment.tryout.id}/result`} className="btn btn-outline btn-sm">
                  Review
                </Link>
              </div>
            </div>
          ))}

          {completedAssignments.length === 0 && (
            <div className="empty-state">Belum ada tryout yang diselesaikan.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderAssignmentCard(assignment: any) {
  const dur = assignment.tryout.duration as number | null;
  return (
    <div key={assignment.id} className="card dashboard-assignment-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {assignment.status === 'ONGOING' && (
        <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.3rem 0.75rem', backgroundColor: 'var(--warning)', color: 'white', fontSize: '0.7rem', fontWeight: 800, borderRadius: '0 0 0 10px' }}>
          MELANJUTKAN
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{assignment.tryout.category as string}</span>
        </div>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.35rem', lineHeight: 1.4 }}>{assignment.tryout.title as string}</h3>
        <p className="text-muted text-xs" style={{ marginBottom: '1.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
          {assignment.tryout.description as string || 'Uji kemampuan Anda dengan latihan soal berkualitas ini.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="text-muted" style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ filter: 'grayscale(100%)' }}>📝</span> <strong>{assignment.tryout._count.questions}</strong> Soal
          </div>
          {dur && (
            <div className="text-muted" style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ filter: 'grayscale(100%)' }}>⏱</span> <strong>{dur}</strong> Menit
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/student/tryouts/${assignment.tryout.id}`}
        className={`btn ${assignment.status === 'ONGOING' ? 'btn-warning' : 'btn-primary'}`}
        style={{ width: '100%', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, padding: '0.75rem' }}
      >
        {assignment.status === 'ONGOING' ? 'Lanjutkan Sekarang' : 'Mulai Ujian'}
      </Link>
    </div>
  );
}
