import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export default async function StudentDashboard() {
  const session = await getSession();

  if (!session) return null;

  const assignments = await prisma.assignment.findMany({
    where: { studentId: session.id },
    include: {
      tryout: {
        include: {
          _count: { select: { questions: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const pendingAssignments = assignments.filter(a => a.status === 'PENDING' || a.status === 'ONGOING');
  const completedAssignments = assignments.filter(a => a.status === 'COMPLETED');

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Selamat Datang, {session.name} 👋</h1>
        <p>Ini adalah daftar paket tryout yang ditugaskan kepada Anda.</p>
      </div>

      {/* Active Assignments */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Tugas Baru & Sedang Dikerjakan</h2>

        <div className="grid grid-auto" style={{ gap: '1rem' }}>
          {pendingAssignments.map(assignment => {
            const dur = (assignment.tryout as Record<string, unknown>).duration as number | null;
            return (
              <div key={assignment.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                    <span className="badge badge-primary">{assignment.tryout.category}</span>
                    <span className={`badge ${assignment.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'}`}>
                      {assignment.status === 'ONGOING' ? 'Melanjutkan' : 'Belum Mulai'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>{assignment.tryout.title}</h3>
                  <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
                    {assignment.tryout.description || 'Tidak ada deskripsi'}
                  </p>
                  <div className="text-sm font-medium" style={{ marginBottom: '1rem' }}>
                    Total Soal: {assignment.tryout._count.questions} Butir
                    {dur && (
                      <span style={{ marginLeft: '0.75rem' }}>⏱ {dur} menit</span>
                    )}
                  </div>
                </div>

                <Link
                  href={`/student/tryouts/${assignment.tryoutId}`}
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  {assignment.status === 'ONGOING' ? 'Lanjutkan' : 'Mulai Kerjakan'}
                </Link>
              </div>
            );
          })}

          {pendingAssignments.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              Tidak ada tugas tryout baru saat ini.
            </div>
          )}
        </div>
      </div>

      {/* Completed */}
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Riwayat Pengerjaan</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {completedAssignments.map(assignment => (
            <div key={assignment.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{assignment.tryout.title}</div>
                <div className="text-muted text-sm">Diselesaikan: {assignment.endTime ? new Date(assignment.endTime).toLocaleDateString('id-ID') : '-'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-muted text-xs">Skor</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
                    {assignment.score?.toFixed(0) || '0'}
                  </div>
                </div>
                <Link href={`/student/tryouts/${assignment.tryoutId}/result`} className="btn btn-outline btn-sm">
                  Detail
                </Link>
              </div>
            </div>
          ))}

          {completedAssignments.length === 0 && (
            <div className="empty-state">
              Belum ada tryout yang diselesaikan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
