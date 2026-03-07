import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import QuestionList from './QuestionList';

export default async function TryoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;

  const tryout = await prisma.tryout.findUnique({
    where: { id: tryoutId },
    include: {
      questions: { orderBy: { createdAt: 'asc' } },
      _count: { select: { assignments: true } }
    }
  });

  if (!tryout) return notFound();

  const dur = (tryout as Record<string, unknown>).duration as number | null;

  const serializedQuestions = tryout.questions.map(q => ({
    id: q.id,
    questionType: (q as Record<string, unknown>).questionType as string,
    questionText: q.questionText,
    imageUrl: (q as Record<string, unknown>).imageUrl as string | null,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    optionE: q.optionE,
    correctAnswer: q.correctAnswer,
  }));

  return (
    <div className="animate-in">
      <div className="page-header">
        <Link href="/admin/tryouts" className="back-link">← Kembali ke daftar tryout</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary">{tryout.category}</span>
              {dur && <span className="badge badge-warning">⏱ {dur} menit</span>}
            </div>
            <h1>{tryout.title}</h1>
            <p style={{ marginBottom: '1rem' }}>{tryout.description || 'Tidak ada deskripsi'}</p>

            {(tryout.pdfLink || tryout.youtubeLink) && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {tryout.pdfLink && (
                  <a href={tryout.pdfLink} target="_blank" rel="noreferrer" className="text-primary font-semibold" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    📄 PDF Pembahasan
                  </a>
                )}
                {tryout.youtubeLink && (
                  <a href={tryout.youtubeLink} target="_blank" rel="noreferrer" className="text-danger font-semibold" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    ▶️ Video YouTube
                  </a>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href={`/admin/tryouts/${tryout.id}/edit`} className="btn btn-outline" style={{ background: 'white' }}>✏️ Edit Info</Link>
            <Link href={`/admin/tryouts/${tryout.id}/assign`} className="btn btn-primary">Tugaskan ke Siswa</Link>
          </div>
        </div>
      </div>
      <QuestionList tryoutId={tryoutId} initialQuestions={serializedQuestions} />
    </div>
  );
}
