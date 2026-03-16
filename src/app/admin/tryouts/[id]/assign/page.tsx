import { notFound } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function AssignTryoutPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;

  const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
  if (!tryoutDoc.exists) return notFound();

  const tryoutData = tryoutDoc.data()!;

  const assignmentsSnap = await db.collection('assignments').where('tryoutId', '==', tryoutId).get();
  const assignments = await Promise.all(assignmentsSnap.docs.map(async (doc) => {
    const a = doc.data();
    const studentSnap = await db.collection('users').doc(a.studentId as string).get();
    return {
      id: doc.id,
      ...a,
      student: { id: studentSnap.id, ...(studentSnap.exists ? studentSnap.data() : { name: 'Unknown', username: 'unknown' }) }
    };
  }));

  const tryout = { id: tryoutDoc.id, ...tryoutData, assignments };

  const studentsSnap = await db.collection('users').where('role', '==', 'STUDENT').get();
  const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const assignedStudentIds = tryout.assignments.map((a: any) => a.studentId as string);
  const availableStudents = students.filter(s => !assignedStudentIds.includes(s.id));

  async function assignToStudent(formData: FormData) {
    'use server';
    const studentId = formData.get('studentId') as string;

    if (studentId) {
      await db.collection('assignments').add({
        tryoutId,
        studentId,
        status: 'PENDING',
        score: null,
        durationTaken: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      revalidatePath(`/admin/tryouts/${tryoutId}/assign`);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <Link href="/admin/tryouts" className="back-link">← Kembali</Link>
        <h1>Assign Tryout: {(tryout as any).title as string}</h1>
        <p>Atur siswa mana saja yang dapat mengerjakan tryout ini.</p>
        <p>Paket: <strong>{(tryout as any).title as string}</strong></p>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        {/* Form */}
        <div className="card">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>Tugaskan ke Siswa Baru</h2>

          {availableStudents.length > 0 ? (
            <form action={assignToStudent}>
              <div className="form-group">
                <label className="form-label" htmlFor="studentId">Pilih Siswa</label>
                <select
                  id="studentId"
                  name="studentId"
                  className="form-input"
                  required
                >
                  <option value="" disabled>-- Pilih Siswa --</option>
                  {availableStudents.map((student: any) => (
                    <option key={student.id} value={student.id}>{student.name as string} (@{student.username as string})</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Tugaskan Sekarang</button>
            </form>
          ) : (
            <div className="empty-state">
              Semua siswa sudah ditugaskan untuk tryout ini.
            </div>
          )}
        </div>

        {/* Siswa Tertugas */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-light)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Siswa Tertugas ({tryout.assignments.length})</h2>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tryout.assignments.map((assignment: any) => (
                  <tr key={assignment.id}>
                    <td style={{ fontWeight: 500 }}>{assignment.student.name as string}</td>
                    <td className="text-muted">@{assignment.student.username as string}</td>
                    <td>
                      <span className={`badge ${assignment.status === 'COMPLETED' ? 'badge-success' :
                        assignment.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'
                        }`}>
                        {assignment.status as string}
                      </span>
                    </td>
                  </tr>
                ))}
                {tryout.assignments.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Belum ada siswa yang ditugaskan</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
