import { notFound } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import Link from 'next/link';
import QuestionList from './QuestionList';
import GoogleDocsButton from './GoogleDocsButton';

export const dynamic = 'force-dynamic';

export default async function TryoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;

  const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();

  if (!tryoutDoc.exists) return notFound();

  const tryoutData = tryoutDoc.data()!;

  // Get questions manually
  const questionsSnap = await db.collection('questions')
    .where('tryoutId', '==', tryoutId)
    .get();

  const questionsDocs = questionsSnap.docs.sort((a, b) => {
    const dateA = a.data().createdAt?.toDate?.() || new Date(0);
    const dateB = b.data().createdAt?.toDate?.() || new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  const questions = questionsDocs.map(doc => ({ id: doc.id, ...doc.data() }));

  const dur = tryoutData.duration as number | null;

  const serializedQuestions = questions.map((q: any) => ({
    id: q.id,
    questionType: q.questionType as string,
    questionText: q.questionText as string,
    imageUrl: q.imageUrl as string | null,
    optionA: q.optionA as string | null,
    optionB: q.optionB as string | null,
    optionC: q.optionC as string | null,
    optionD: q.optionD as string | null,
    optionE: q.optionE as string | null,
    correctAnswer: q.correctAnswer as string,
    pembahasan: q.pembahasan as string | null,
  }));

  return (
    <div className="animate-in">
      <div className="page-header">
        <Link href="/admin/tryouts" className="back-link">← Kembali ke daftar tryout</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary">{tryoutData.category}</span>
              {dur && <span className="badge badge-warning">⏱ {dur} menit</span>}
            </div>
            <h1>{tryoutData.title}</h1>
            <p style={{ marginBottom: '1rem' }}>{tryoutData.description || 'Tidak ada deskripsi'}</p>

            {(tryoutData.pdfLink || tryoutData.youtubeLink) && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {tryoutData.pdfLink && (
                  <a href={tryoutData.pdfLink} target="_blank" rel="noreferrer" className="text-primary font-semibold" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    📄 PDF Pembahasan
                  </a>
                )}
                {tryoutData.youtubeLink && (
                  <a href={tryoutData.youtubeLink} target="_blank" rel="noreferrer" className="text-danger font-semibold" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    ▶️ Video YouTube
                  </a>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <GoogleDocsButton 
              tryoutId={tryoutId} 
              googleDocUrl={tryoutData.googleDocUrl as string | null} 
            />

            <a href={`/print/${tryoutDoc.id}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ background: 'var(--bg-color)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none', color: 'inherit' }}>
              🖨️ Print Soal (Lokal)
            </a>
            <Link href={`/admin/tryouts/${tryoutDoc.id}/edit`} className="btn btn-outline" style={{ background: 'white' }}>✏️ Edit Info</Link>
          </div>
        </div>
      </div>
      <QuestionList tryoutId={tryoutId} initialQuestions={serializedQuestions} />
    </div>
  );
}
