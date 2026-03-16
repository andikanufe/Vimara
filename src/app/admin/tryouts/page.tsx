import { db } from '@/lib/firebase-admin';
import Link from 'next/link';
import DeleteTryoutBtn from './DeleteTryoutBtn';

export const dynamic = 'force-dynamic';

export default async function TryoutsPage() {
  const tryoutsSnap = await db.collection('tryouts').get();
  const tryoutsDocs = tryoutsSnap.docs.sort((a, b) => {
    const dateA = a.data().createdAt?.toDate?.() || new Date(0);
    const dateB = b.data().createdAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const tryouts = await Promise.all(tryoutsDocs.map(async (doc) => {
    const qCountSnap = await db.collection('questions').where('tryoutId', '==', doc.id).count().get();
    const aCountSnap = await db.collection('assignments').where('tryoutId', '==', doc.id).count().get();
    return {
      id: doc.id,
      ...doc.data(),
      _count: {
        questions: qCountSnap.data().count,
        assignments: aCountSnap.data().count
      }
    };
  }));

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
              {tryouts.map((tryout: any) => {
                const dur = tryout.duration as number | null;
                return (
                  <tr key={tryout.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{tryout.title as string}</div>
                      {tryout.description && <div className="text-muted text-sm">{tryout.description as string}</div>}
                    </td>
                    <td><span className="badge badge-primary">{tryout.category as string}</span></td>
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
                        <DeleteTryoutBtn tryoutId={tryout.id} tryoutTitle={tryout.title as string} />
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
