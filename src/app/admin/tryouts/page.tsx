import prisma from '@/lib/prisma';
import Link from 'next/link';

export default async function TryoutsPage() {
  const tryouts = await prisma.tryout.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { questions: true, assignments: true } }
    }
  });

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Manajemen Tryout</h1>
        </div>
        <Link href="/admin/tryouts/create" className="btn btn-primary">
          + Buat Tryout Baru
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
                <th>Durasi</th>
                <th>Ditugaskan</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tryouts.map((tryout) => {
                const dur = (tryout as Record<string, unknown>).duration as number | null;
                return (
                  <tr key={tryout.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{tryout.title}</div>
                      {tryout.description && <div className="text-muted text-sm">{tryout.description}</div>}
                    </td>
                    <td><span className="badge badge-primary">{tryout.category}</span></td>
                    <td>{tryout._count.questions}</td>
                    <td>
                      {dur ? (
                        <span className="badge badge-warning">⏱ {dur} menit</span>
                      ) : (
                        <span className="text-muted text-sm">Tanpa batas</span>
                      )}
                    </td>
                    <td>{tryout._count.assignments}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Link href={`/admin/tryouts/${tryout.id}`} className="btn btn-outline btn-sm">
                          Detail / Soal
                        </Link>
                        <Link href={`/admin/tryouts/${tryout.id}/assign`} className="btn btn-primary btn-sm">
                          Tugaskan
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tryouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ border: 'none' }}>
                    Belum ada paket tryout. Silakan buat baru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
