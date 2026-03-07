import prisma from '@/lib/prisma';

export default async function StudentsPage() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    include: {
      assignments: {
        include: { tryout: true }
      }
    }
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1>Data Siswa & Hasil Tryout</h1>
            <p>Pantau progres dan nilai tryout seluruh siswa.</p>
          </div>
          <a href="/api/export/students" className="btn btn-primary btn-sm">📥 Export Semua Nilai</a>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {students.map(student => (
          <div key={student.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{student.name}</h2>
                <div className="text-muted text-sm">@{student.username}</div>
              </div>
              <div>
                <span className="badge badge-primary">
                  Selesai: {student.assignments.filter(a => a.status === 'COMPLETED').length} / {student.assignments.length}
                </span>
              </div>
            </div>

            <div className="table-wrap">
              <table style={{ fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th>Tryout</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {student.assignments.map(assignment => (
                    <tr key={assignment.id}>
                      <td style={{ fontWeight: 500 }}>{assignment.tryout.title}</td>
                      <td>
                        <span className={`badge ${assignment.status === 'COMPLETED' ? 'badge-success' :
                            assignment.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'
                          }`}>
                          {assignment.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: assignment.score !== null ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {assignment.score !== null ? assignment.score.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                  {student.assignments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted" style={{ padding: '1rem 0' }}>Belum ada tryout ditugaskan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <div className="empty-state">
            Belum ada data siswa terdaftar.
          </div>
        )}
      </div>
    </div>
  );
}
