import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export default async function TryoutIntroPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;
  const session = await getSession();

  if (!session) return redirect('/');

  const assignmentSnap = await db.collection('assignments')
    .where('studentId', '==', session.id)
    .get();

  const aDocFound = assignmentSnap.docs.find(d => d.data().tryoutId === tryoutId);
  if (!aDocFound) return notFound();

  const aDocId = aDocFound.id;
  const assignmentData = aDocFound.data();

  if (assignmentData.status === 'COMPLETED') {
    return redirect(`/student/tryouts/${tryoutId}/result`);
  }

  const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
  if (!tryoutDoc.exists) return notFound();

  const tryoutData = tryoutDoc.data()!;

  const qCountSnap = await db.collection('questions').where('tryoutId', '==', tryoutId).count().get();

  const assignment = {
    id: aDocId,
    ...assignmentData,
    tryout: {
      ...tryoutData,
      _count: { questions: qCountSnap.data().count }
    }
  } as any;

  const dur = tryoutData.duration as number | null;

  async function startTryout() {
    'use server';

    if (assignmentData.status === 'PENDING') {
      await db.collection('assignments').doc(aDocId).update({
        status: 'ONGOING',
        startTime: new Date()
      });
    }

    redirect(`/student/take/${tryoutId}`);
  }

  return (
    <div className="animate-in" style={{ maxWidth: '550px', margin: '0 auto', paddingTop: '1rem' }}>
      <Link href="/student/dashboard" className="back-link">
        ← Kembali ke Dashboard
      </Link>

      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
          {assignment.tryout.category as string}
        </span>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>{assignment.tryout.title as string}</h1>
        <p className="text-muted text-sm" style={{ marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          {assignment.tryout.description as string || 'Tidak ada deskripsi spesifik untuk tryout ini.'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
          <div>
            <div className="text-muted text-xs font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jumlah Soal</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{assignment.tryout._count.questions}</div>
          </div>
          <div>
            <div className="text-muted text-xs font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Durasi</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: dur ? 'var(--warning)' : 'var(--text-muted)' }}>
              {dur ? `${dur} menit` : '∞'}
            </div>
          </div>
          <div>
            <div className="text-muted text-xs font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: assignment.status === 'ONGOING' ? 'var(--warning)' : 'inherit' }}>
              {assignment.status === 'ONGOING' ? 'Lanjutkan' : 'Baru'}
            </div>
          </div>
        </div>

        {dur && (
          <div className="text-sm text-muted" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            ⏱ Waktu akan berjalan otomatis setelah mulai mengerjakan
          </div>
        )}

        <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.875rem', lineHeight: 1.6, border: '1px solid var(--primary)' }}>
          <strong>📋 Informasi Mengerjakan & Hasil:</strong><br />
          Anda diwajibkan untuk mengerjakan ujian secara online terlebih dahulu. Jika nilai Anda <strong>kurang dari atau sama dengan 70</strong>, sistem akan menyediakan tombol <strong>Download Soal (PDF)</strong> di halaman hasil agar Anda bisa melakukan <strong>Ulangi Ujian</strong>. Kunci jawaban lengkap belum akan ditampilkan.<br /><br />
          Jika nilai capaian Anda sudah <strong>lebih dari 70</strong>, maka seluruh fitur akan terbuka penuh, termasuk <strong>Download Soal PDF</strong>, <strong>Link Video Pembahasan</strong>, dan <strong>Kunci Jawaban Lengkap</strong>.
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <form action={startTryout}>
            <button type="submit" className="btn btn-primary btn-lg">
              {assignment.status === 'ONGOING' ? 'Lanjutkan Pengerjaan' : 'Mulai Sekarang'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
