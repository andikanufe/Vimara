import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';

export default async function TryoutIntroPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;
  const session = await getSession();

  if (!session) return redirect('/');

  const assignment = await prisma.assignment.findFirst({
    where: {
      tryoutId: tryoutId,
      studentId: session.id
    },
    include: {
      tryout: {
        include: {
          _count: { select: { questions: true } }
        }
      }
    }
  });

  if (!assignment) return notFound();

  if (assignment.status === 'COMPLETED') {
    return redirect(`/student/tryouts/${tryoutId}/result`);
  }

  const dur = (assignment.tryout as Record<string, unknown>).duration as number | null;

  async function startTryout() {
    'use server';

    if (assignment?.status === 'PENDING') {
      await prisma.assignment.update({
        where: { id: assignment.id },
        data: {
          status: 'ONGOING',
          startTime: new Date()
        }
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
          {assignment.tryout.category}
        </span>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>{assignment.tryout.title}</h1>
        <p className="text-muted text-sm" style={{ marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          {assignment.tryout.description || 'Tidak ada deskripsi spesifik untuk tryout ini.'}
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

        <form action={startTryout}>
          <button type="submit" className="btn btn-primary btn-lg">
            {assignment.status === 'ONGOING' ? 'Lanjutkan Pengerjaan' : 'Mulai Sekarang'}
          </button>
        </form>
      </div>
    </div>
  );
}
