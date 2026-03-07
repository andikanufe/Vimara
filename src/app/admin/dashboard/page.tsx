import prisma from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminDashboard() {
  const tryoutCount = await prisma.tryout.count();
  const studentCount = await prisma.user.count({ where: { role: 'STUDENT' } });
  const assignmentCount = await prisma.assignment.count();
  
  const recentTryouts = await prisma.tryout.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { questions: true, assignments: true } }
    }
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Dashboard Overview</h1>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Tryout Terbaru</h2>
        <Link href="/admin/tryouts" className="btn btn-primary btn-sm">
          Kelola Tryout
        </Link>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Soal</th>
                <th>Ditugaskan</th>
                <th>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {recentTryouts.map((tryout) => (
                <tr key={tryout.id}>
                  <td style={{ fontWeight: 500 }}>{tryout.title}</td>
                  <td><span className="badge badge-primary">{tryout.category}</span></td>
                  <td>{tryout._count.questions}</td>
                  <td>{tryout._count.assignments}</td>
                  <td className="text-muted text-sm">{new Date(tryout.createdAt).toLocaleDateString('id-ID')}</td>
                </tr>
              ))}
              {recentTryouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state" style={{ border: 'none' }}>Belum ada tryout</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
