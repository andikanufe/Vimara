import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export default async function AssignTryoutPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;

  const tryout = await prisma.tryout.findUnique({
    where: { id: tryoutId },
    include: {
      assignments: {
        include: { student: true }
      }
    }
  });

  if (!tryout) return notFound();

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
  });

  const assignedStudentIds = tryout.assignments.map(a => a.studentId);
  const availableStudents = students.filter(s => !assignedStudentIds.includes(s.id));

  async function assignToStudent(formData: FormData) {
    'use server';
    const studentId = formData.get('studentId') as string;
    
    if (studentId) {
      await prisma.assignment.create({
        data: { tryoutId, studentId }
      });
      revalidatePath(`/admin/tryouts/${tryoutId}/assign`);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <Link href={`/admin/tryouts/${tryoutId}`} className="back-link">
          ← Kembali ke detail tryout
        </Link>
        <h1>Tugaskan Tryout</h1>
        <p>Paket: <strong>{tryout.title}</strong></p>
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
                  {availableStudents.map(student => (
                    <option key={student.id} value={student.id}>{student.name} (@{student.username})</option>
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
                {tryout.assignments.map(assignment => (
                  <tr key={assignment.id}>
                    <td style={{ fontWeight: 500 }}>{assignment.student.name}</td>
                    <td className="text-muted">@{assignment.student.username}</td>
                    <td>
                      <span className={`badge ${
                        assignment.status === 'COMPLETED' ? 'badge-success' : 
                        assignment.status === 'ONGOING' ? 'badge-warning' : 'badge-muted'
                      }`}>
                        {assignment.status}
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
