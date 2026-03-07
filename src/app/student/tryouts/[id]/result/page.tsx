import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import MathText from '@/components/MathText';

export default async function TryoutResultPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;
  const session = await getSession();

  if (!session) return redirect('/');

  const assignment = await prisma.assignment.findFirst({
    where: { tryoutId, studentId: session.id },
    include: {
      tryout: { include: { questions: { orderBy: { id: 'asc' } } } },
      answers: true
    }
  });

  if (!assignment) return notFound();
  if (assignment.status !== 'COMPLETED') return redirect(`/student/tryouts/${tryoutId}`);

  let correctCount = 0;
  let wrongCount = 0;
  let emptyCount = 0;

  assignment.tryout.questions.forEach(q => {
    const answer = assignment.answers.find(a => a.questionId === q.id);
    const qType = (q as Record<string, unknown>).questionType as string;
    const ansText = answer ? (answer as Record<string, unknown>).answerText as string | null : null;

    if (qType === 'ISIAN') {
      if (!ansText || ansText.trim() === '') {
        emptyCount++;
      } else if (ansText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        correctCount++;
      } else {
        wrongCount++;
      }
    } else if (!answer?.selectedOption) {
      emptyCount++;
    } else if (qType === 'PGK') {
      const correctSet = q.correctAnswer.split(',').sort().join(',');
      const studentSet = answer.selectedOption.split(',').sort().join(',');
      if (correctSet === studentSet) correctCount++;
      else wrongCount++;
    } else {
      if (answer.selectedOption === q.correctAnswer) correctCount++;
      else wrongCount++;
    }
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <Link href="/student/dashboard" className="back-link">← Kembali ke Dashboard</Link>
        <h1>Hasil: {assignment.tryout.title}</h1>
        <p>Diselesaikan: {assignment.endTime ? new Date(assignment.endTime).toLocaleString('id-ID') : '-'}</p>
      </div>

      {/* Score Summary */}
      <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div className="text-muted text-xs font-bold" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Skor Akhir</div>
        <div className="score-circle" style={{
          borderColor: assignment.score && assignment.score >= 70 ? 'var(--success)' : assignment.score && assignment.score >= 40 ? 'var(--warning)' : 'var(--danger)'
        }}>
          <span style={{ fontSize: '2rem', fontWeight: 700 }}>{assignment.score?.toFixed(0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{correctCount}</div>
            <div className="text-muted text-xs">Benar</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }}>{wrongCount}</div>
            <div className="text-muted text-xs">Salah</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>{emptyCount}</div>
            <div className="text-muted text-xs">Kosong</div>
          </div>
        </div>
      </div>

      {/* Pembahasan Links */}
      {(assignment.tryout.pdfLink || assignment.tryout.youtubeLink) && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Materi Pembahasan</h2>
          <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: '0.25rem' }}>Pelajari kembali materi dan pembahasan tryout ini.</p>
              <p className="text-muted text-sm">Gunakan link di bawah ini untuk melihat pembahasan detail tiap soal.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {assignment.tryout.pdfLink && (
                <a href={assignment.tryout.pdfLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📄 PDF Pembahasan
                </a>
              )}
              {assignment.tryout.youtubeLink && (
                <a href={assignment.tryout.youtubeLink} target="_blank" rel="noreferrer" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--danger)', color: 'white' }}>
                  ▶️ Video YouTube
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Review Jawaban</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {assignment.tryout.questions.map((q, idx) => {
          const answer = assignment.answers.find(a => a.questionId === q.id);
          const qType = (q as Record<string, unknown>).questionType as string;
          const imgUrl = (q as Record<string, unknown>).imageUrl as string | null;
          const ansText = answer ? (answer as Record<string, unknown>).answerText as string | null : null;

          let isEmpty = false;
          let isCorrect = false;

          if (qType === 'ISIAN') {
            isEmpty = !ansText || ansText.trim() === '';
            isCorrect = !isEmpty && ansText!.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
          } else {
            isEmpty = !answer?.selectedOption;
            if (!isEmpty) {
              if (qType === 'PGK') {
                isCorrect = q.correctAnswer.split(',').sort().join(',') === (answer?.selectedOption || '').split(',').sort().join(',');
              } else {
                isCorrect = answer?.selectedOption === q.correctAnswer;
              }
            }
          }

          const correctAnswerList = q.correctAnswer.split(',');
          const studentAnswerList = answer?.selectedOption ? answer.selectedOption.split(',') : [];

          const typeBadge = qType === 'PGK' ? 'badge-warning' : qType === 'ISIAN' ? 'badge-success' : qType === 'BENAR_SALAH' ? 'badge-info' : 'badge-muted';
          const typeLabel = qType === 'BENAR_SALAH' ? 'B/S' : qType;

          return (
            <div key={q.id} className="card" style={{
              borderLeft: `3px solid ${isEmpty ? 'var(--border)' : isCorrect ? 'var(--success)' : 'var(--danger)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="font-semibold text-sm">Soal No. {idx + 1}</span>
                  <span className={`badge ${typeBadge}`}>{typeLabel}</span>
                </div>
                <span className={`badge ${isEmpty ? 'badge-muted' : isCorrect ? 'badge-success' : 'badge-danger'}`}>
                  {isEmpty ? 'KOSONG' : isCorrect ? 'BENAR' : 'SALAH'}
                </span>
              </div>

              {imgUrl && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <img src={imgUrl} alt="Soal" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              )}

              <div style={{ marginBottom: '1rem', lineHeight: 1.6 }}><MathText text={q.questionText} /></div>

              {/* ISIAN Review */}
              {qType === 'ISIAN' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
                  <div className={`result-option ${isCorrect ? 'correct' : !isEmpty ? 'wrong' : ''}`}>
                    <span style={{ fontWeight: 700, width: '100px', flexShrink: 0 }}>Jawaban Anda:</span>
                    <span style={{ flex: 1 }}>{ansText || <span className="text-muted">- Tidak dijawab -</span>}</span>
                  </div>
                  <div className="result-option correct">
                    <span style={{ fontWeight: 700, width: '100px', flexShrink: 0 }}>Kunci:</span>
                    <span style={{ flex: 1 }}><MathText text={q.correctAnswer} /></span>
                  </div>
                </div>
              ) : qType === 'BENAR_SALAH' ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                        <th style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'left', fontSize: '0.875rem' }}>Pernyataan</th>
                        <th style={{ padding: '0.5rem', border: '1px solid var(--border)', width: '60px', textAlign: 'center', fontSize: '0.875rem' }}>Benar</th>
                        <th style={{ padding: '0.5rem', border: '1px solid var(--border)', width: '60px', textAlign: 'center', fontSize: '0.875rem' }}>Salah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[{ opt: 'A', index: 0 }, { opt: 'B', index: 1 }, { opt: 'C', index: 2 }, { opt: 'D', index: 3 }, { opt: 'E', index: 4 }].map(item => {
                        const optionText = q[`option${item.opt}` as keyof typeof q] as string | null;
                        if (!optionText) return null;
                        const studentAns = studentAnswerList[item.index];
                        const correctAns = correctAnswerList[item.index];
                        return (
                          <tr key={item.opt}>
                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem' }}><MathText text={optionText} /></td>
                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                              {studentAns === 'B' ? (studentAns === correctAns ? '✓' : '❌') : (correctAns === 'B' ? <span className="text-muted">✓</span> : '')}
                            </td>
                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                              {studentAns === 'S' ? (studentAns === correctAns ? '✓' : '❌') : (correctAns === 'S' ? <span className="text-muted">✓</span> : '')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
                  {['A', 'B', 'C', 'D', 'E'].map(opt => {
                    const optText = q[`option${opt}` as keyof typeof q];
                    if (!optText) return null;
                    const isStudentAnswer = studentAnswerList.includes(opt);
                    const isActualCorrect = correctAnswerList.includes(opt);
                    let className = 'result-option';
                    if (isActualCorrect) className += ' correct';
                    else if (isStudentAnswer && !isCorrect) className += ' wrong';
                    return (
                      <div key={opt} className={className}>
                        <span style={{ fontWeight: 700, width: '20px', flexShrink: 0 }}>{opt}.</span>
                        <span style={{ flex: 1 }}><MathText text={optText as string} /></span>
                        {isActualCorrect && <span className="text-xs font-bold">Kunci</span>}
                        {isStudentAnswer && !isActualCorrect && <span className="text-xs font-bold">Jawaban Anda</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
