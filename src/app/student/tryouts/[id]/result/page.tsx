import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import MathText from '@/components/MathText';

export default async function TryoutResultPage({ params }: { params: Promise<{ id: string }> }) {
  const tryoutId = (await params).id;
  const session = await getSession();

  if (!session) return redirect('/');

  const assignmentSnap = await db.collection('assignments')
    .where('studentId', '==', session.id)
    .get();

  const aDocFound = assignmentSnap.docs.find(d => d.data().tryoutId === tryoutId);
  if (!aDocFound) return notFound();

  const aDoc = aDocFound;
  const assignmentData = aDoc.data();

  if (assignmentData.status !== 'COMPLETED') return redirect(`/student/tryouts/${tryoutId}`);

  // Fetch Tryout
  const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
  if (!tryoutDoc.exists) return notFound();
  const tryoutData = tryoutDoc.data()!;

  // Fetch Questions
  const questionsSnap = await db.collection('questions').where('tryoutId', '==', tryoutId).get();
  const questions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id));

  // Fetch Answers
  const answersSnap = await db.collection('answers').where('assignmentId', '==', aDoc.id).get();
  const answers = answersSnap.docs.map(doc => doc.data());

  const assignment = {
    id: aDoc.id,
    ...assignmentData,
    tryout: {
      ...tryoutData,
      title: tryoutData.title as string,
      pdfLink: tryoutData.pdfLink as string | null,
      youtubeLink: tryoutData.youtubeLink as string | null,
      questions
    },
    answers
  };

  let correctCount = 0;
  let wrongCount = 0;
  let emptyCount = 0;

  assignment.tryout.questions.forEach((q: any) => {
    const answer = assignment.answers.find((a: any) => a.questionId === q.id);
    const qType = q.questionType as string;
    const ansText = answer ? answer.answerText as string | null : null;
    const correctAnsStr = String(q.correctAnswer);

    if (qType === 'ISIAN') {
      if (!ansText || ansText.trim() === '') {
        emptyCount++;
      } else if (ansText.trim().toLowerCase() === correctAnsStr.trim().toLowerCase()) {
        correctCount++;
      } else {
        wrongCount++;
      }
    } else if (!answer?.selectedOption) {
      emptyCount++;
    } else if (qType === 'PGK') {
      const correctSet = correctAnsStr.split(',').sort().join(',');
      const studentSet = String(answer.selectedOption).split(',').sort().join(',');
      if (correctSet === studentSet) correctCount++;
      else wrongCount++;
    } else if (qType === 'BENAR_SALAH') {
      const optionsArr = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
      const lastIdx = optionsArr.reduce((acc: number, opt: any, i: number) => (opt && String(opt).trim() !== '' ? i : acc), 0);
      const correctArr = correctAnsStr.split(',').slice(0, lastIdx + 1);
      const studentArr = String(answer.selectedOption || '').split(',').slice(0, lastIdx + 1);
      if (correctArr.join(',') === studentArr.join(',')) correctCount++;
      else wrongCount++;
    } else {
      if (answer.selectedOption === correctAnsStr) correctCount++;
      else wrongCount++;
    }
  });

  const totalQuestions = assignment.tryout.questions.length;
  const calculatedScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  let score = 0;
  if ((assignment.tryout as any).scoringType === 'IRT' || Math.abs(calculatedScore - Number((assignment as any).score)) > 0.01) {
    // Already calculated robustly
    score = calculatedScore;
  } else {
    // For regular / backward compability
    score = Number((assignment as any).score);
  }

  // Update Score robustly if missing or wrong
  if ((assignment as any).status === 'COMPLETED' && (!(assignment as any).score || Math.abs(calculatedScore - Number((assignment as any).score)) > 0.01)) {
    await db.collection('assignments').doc(aDoc.id).update({
      score: calculatedScore
    });
    score = calculatedScore;
  }

  const tData = (assignment.tryout as any);
  const aData = (assignment as any);
  const dur = tData.duration as number | null;

  // Robustly handle time calculation with multiple field possibilities
  const rawStarted = aData.startedAt || aData.startTime;
  const rawCompleted = aData.completedAt || aData.endTime;

  const startedDate = rawStarted?.toDate ? rawStarted.toDate() : (rawStarted ? new Date(rawStarted) : null);
  const completedDate = rawCompleted?.toDate ? rawCompleted.toDate() : (rawCompleted ? new Date(rawCompleted) : null);

  const timeUsed = startedDate && completedDate
    ? Math.round((completedDate.getTime() - startedDate.getTime()) / 60000)
    : null;

  // Extract simple strings for Server Action closure to avoid serialization errors
  const currentAssignmentId = aDoc.id;
  const currentTryoutId = tryoutId;

  async function retakeTryout() {
    'use server';
    const batch = db.batch();

    // Clear the answers
    const answersSnapToDel = await db.collection('answers').where('assignmentId', '==', currentAssignmentId).get();
    answersSnapToDel.docs.forEach(d => {
      batch.delete(d.ref);
    });

    // Reset assignment status and all possible timestamp fields
    batch.update(db.collection('assignments').doc(currentAssignmentId), {
      status: 'PENDING',
      score: null,
      startedAt: null,
      completedAt: null,
      startTime: null,
      endTime: null
    });

    await batch.commit();
    redirect(`/student/tryouts/${currentTryoutId}`);
  }

  return (
    <div className="animate-in" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '1rem' }}>
      <Link href="/student/dashboard" className="back-link">
        ← Kembali ke Dashboard
      </Link>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Hasil Tryout</h1>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {(assignment.tryout as any).title as string}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className="badge badge-primary">{(assignment.tryout as any).category as string}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-muted text-xs font-bold" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Skor Akhir</div>
            <div className="score-circle" style={{
              borderColor: score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)',
              width: '80px', height: '80px', fontSize: '1.75rem', fontWeight: 700, lineHeight: '80px', margin: '0 auto'
            }}>
              {score.toFixed(0)}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a href={`/print/${tryoutId}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                🖨️ Download Soal (PDF)
              </a>

              {score <= 70 && (
                <form action={retakeTryout}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>Ulangi Ujian</button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{correctCount}</div>
            <div className="text-muted text-xs">Benar</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }}>{wrongCount}</div>
            <div className="text-muted text-xs">Salah</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>{emptyCount}</div>
            <div className="text-muted text-xs">Kosong</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalQuestions}</div>
            <div className="text-muted text-xs">Total Soal</div>
          </div>
          {timeUsed !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{timeUsed} menit</div>
              <div className="text-muted text-xs">Waktu Pengerjaan</div>
            </div>
          )}
          {dur !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{dur} menit</div>
              <div className="text-muted text-xs">Durasi Tryout</div>
            </div>
          )}
        </div>
      </div>

      {/* Pembahasan Links */}
      {(assignment.tryout.pdfLink || assignment.tryout.youtubeLink) && score > 70 && (
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
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Review Jawaban</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {((assignment.tryout as any).questions || []).map((q: any, idx: any) => {
          const answer = assignment.answers.find((a: any) => a.questionId === q.id);
          const qType = q.questionType as string;
          const imgUrl = q.imageUrl as string | null;
          const ansText = answer ? answer.answerText as string | null : null;
          const correctAnsStr = String(q.correctAnswer);

          let isEmpty = false;
          let isCorrect = false;

          if (qType === 'ISIAN') {
            isEmpty = !ansText || ansText.trim() === '';
            isCorrect = !isEmpty && ansText!.trim().toLowerCase() === correctAnsStr.trim().toLowerCase();
          } else {
            isEmpty = !answer?.selectedOption;
            if (!isEmpty) {
              if (qType === 'PGK') {
                isCorrect = correctAnsStr.split(',').sort().join(',') === (String(answer?.selectedOption) || '').split(',').sort().join(',');
              } else if (qType === 'BENAR_SALAH') {
                const opts = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
                const li = opts.reduce((a: number, o: any, i: number) => (o && String(o).trim() !== '' ? i : a), 0);
                const ca = correctAnsStr.split(',').slice(0, li + 1);
                const sa = String(answer?.selectedOption || '').split(',').slice(0, li + 1);
                isCorrect = ca.join(',') === sa.join(',');
              } else {
                isCorrect = answer?.selectedOption === correctAnsStr;
              }
            }
          }

          const correctAnswerList = correctAnsStr.split(',');
          const studentAnswerList = answer?.selectedOption ? String(answer.selectedOption).split(',') : [];

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
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                  <img src={imgUrl} alt="Soal" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                </div>
              )}

              <div style={{ marginBottom: '1rem', lineHeight: 1.6 }}><MathText text={q.questionText as string} /></div>

              {/* ISIAN Review */}
              {qType === 'ISIAN' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem' }}>
                  <div className={`result-option ${isCorrect ? 'correct' : !isEmpty ? 'wrong' : ''}`}>
                    <span style={{ fontWeight: 700, width: '100px', flexShrink: 0 }}>Jawaban Anda:</span>
                    <span style={{ flex: 1 }}>{ansText || <span className="text-muted">- Tidak dijawab -</span>}</span>
                  </div>
                  {score > 70 && (
                    <div className="result-option correct">
                      <span style={{ fontWeight: 700, width: '100px', flexShrink: 0 }}>Kunci:</span>
                      <span style={{ flex: 1 }}><MathText text={correctAnsStr} /></span>
                    </div>
                  )}
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
                        const optionText = q[`option${item.opt}`] as string | null;
                        if (!optionText) return null;
                        const studentAns = studentAnswerList[item.index];
                        const correctAns = correctAnswerList[item.index];
                        return (
                          <tr key={item.opt}>
                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', fontSize: '0.875rem' }}><MathText text={optionText} /></td>
                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                              {studentAns === 'B' ? (studentAns === correctAns ? '✓' : '❌') : (score > 70 && correctAns === 'B' ? <span className="text-muted">✓</span> : '')}
                            </td>
                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                              {studentAns === 'S' ? (studentAns === correctAns ? '✓' : '❌') : (score > 70 && correctAns === 'S' ? <span className="text-muted">✓</span> : '')}
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
                    const optText = q[`option${opt}`];
                    if (!optText) return null;
                    const isStudentAnswer = studentAnswerList.includes(opt);
                    const isActualCorrect = correctAnswerList.includes(opt);
                    const showKey = score > 70 || (isStudentAnswer && isActualCorrect);

                    let className = 'result-option';
                    if (showKey && isActualCorrect) className += ' correct';
                    else if (isStudentAnswer && !isActualCorrect) className += ' wrong';

                    if (qType === 'PGK') {
                      return (
                        <div key={opt} className={className} style={{ alignItems: 'flex-start' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px', borderRadius: '4px', border: '2px solid',
                            marginRight: '0.5rem', flexShrink: 0, marginTop: '2px',
                            background: isStudentAnswer ? (isActualCorrect ? 'var(--success)' : 'var(--danger)') : '#fff',
                            borderColor: isStudentAnswer ? (isActualCorrect ? 'var(--success)' : 'var(--danger)') : '#d1d5db',
                            color: '#fff'
                          }}>
                            {isStudentAnswer && <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                          </span>
                          <span style={{ flex: 1 }}><MathText text={optText as string} /></span>
                          {showKey && isActualCorrect && <span className="text-xs font-bold">Kunci</span>}
                          {isStudentAnswer && !isActualCorrect && <span className="text-xs font-bold">Jawaban Anda</span>}
                        </div>
                      );
                    }

                    return (
                      <div key={opt} className={className}>
                        <span style={{ fontWeight: 700, width: '20px', flexShrink: 0 }}>{opt}.</span>
                        <span style={{ flex: 1 }}><MathText text={optText as string} /></span>
                        {showKey && isActualCorrect && <span className="text-xs font-bold">Kunci</span>}
                        {isStudentAnswer && !isActualCorrect && <span className="text-xs font-bold">Jawaban Anda</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pembahasan */}
              {score > 70 && (q as any).pembahasan && (
                <details style={{ marginTop: '1rem', borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', userSelect: 'none' }}>
                    📖 Lihat Pembahasan
                  </summary>
                  <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: 'hsl(270, 50%, 98%)', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(270, 40%, 90%)', lineHeight: 1.7 }}>
                    <MathText text={(q as any).pembahasan as string} />
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
