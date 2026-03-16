import { db } from '@/lib/firebase-admin';

export default async function StudentsPage() {
  const studentsSnap = await db.collection('users').where('role', '==', 'STUDENT').get();

  const students = await Promise.all(studentsSnap.docs.map(async (doc) => {
    const assignmentsSnap = await db.collection('assignments').where('studentId', '==', doc.id).get();
    const assignments = await Promise.all(assignmentsSnap.docs.map(async (aDoc) => {
      const a = aDoc.data();
      const tryoutSnap = await db.collection('tryouts').doc(a.tryoutId as string).get();
      return {
        id: aDoc.id,
        ...a,
        tryout: { id: tryoutSnap.id, ...(tryoutSnap.exists ? tryoutSnap.data() : { title: 'Unknown' }) }
      };
    }));

    return {
      id: doc.id,
      ...doc.data(),
      assignments
    };
  }));

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
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{(student as any).name as string}</h2>
                <div className="text-muted text-sm">@{(student as any).username as string}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
                  <span className="badge badge-primary">
                    Selesai: {((student as any).assignments || []).filter((a: any) => a.status === 'COMPLETED').length} / {((student as any).assignments || []).length}
                  </span>
                </div>
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
                  {((student as any).assignments || []).map((assignment: any) => (
                    <tr key={assignment.id}>
                      <td style={{ fontWeight: 500 }}>{assignment.tryout.title as string}</td>
                      <td>
                        <span className={`badge ${assignment.status === 'COMPLETED' ? 'badge-success' :
                          assignment.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'
                          }`}>
                          {assignment.status as string}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: assignment.score !== null && assignment.score !== undefined ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {assignment.score !== null && assignment.score !== undefined ? Number(assignment.score).toFixed(2) : '-'}
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
