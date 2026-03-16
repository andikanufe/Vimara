import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import MathText from '@/components/MathText';

export default async function PackageAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return redirect('/');

    const tryoutId = (await params).id;
    const tDoc = await db.collection('tryouts').doc(tryoutId).get();
    if (!tDoc.exists) return notFound();

    const tryoutData = tDoc.data()!;

    // Get questions
    const questionsSnap = await db.collection('questions').where('tryoutId', '==', tryoutId).get();
    const questions = questionsSnap.docs.map(doc => {
        const data = doc.data() as { createdAt?: { toMillis?: () => number }; [key: string]: any };
        return { id: doc.id, ...data };
    }).sort((a, b) => {
        const tA = (a.createdAt as any)?.toMillis?.() || 0;
        const tB = (b.createdAt as any)?.toMillis?.() || 0;
        return tA - tB;
    });

    // Get completed assignments
    const assignmentsSnap = await db.collection('assignments')
        .where('tryoutId', '==', tryoutId)
        .where('status', '==', 'COMPLETED')
        .get();

    const assignments = await Promise.all(assignmentsSnap.docs.map(async (aDoc) => {
        const a = aDoc.data();
        const ansSnap = await db.collection('answers').where('assignmentId', '==', aDoc.id).get();
        return {
            id: aDoc.id,
            ...a,
            answers: ansSnap.docs.map(ans => ({ id: ans.id, ...ans.data() }))
        };
    }));

    if (assignments.length === 0) {
        return (
            <div className="animate-in">
                <Link href="/admin/analytics?pov=package" className="back-link">← Kembali ke List Paket</Link>
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                    <h2>Belum ada data pengerjaan</h2>
                    <p className="text-muted">Siswa belum ada yang menyelesaikan tryout ini.</p>
                </div>
            </div>
        );
    }

    const scores = assignments.map((a: any) => Number(a.score) || 0);
    const totalStudents = assignments.length;
    const avg = scores.reduce((a: any, b: any) => a + b, 0) / totalStudents;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    // Score distribution
    const buckets = [0, 0, 0, 0, 0];
    scores.forEach((s: any) => {
        if (s <= 20) buckets[0]++;
        else if (s <= 40) buckets[1]++;
        else if (s <= 60) buckets[2]++;
        else if (s <= 80) buckets[3]++;
        else buckets[4]++;
    });
    const bucketMax = Math.max(...buckets, 1);
    const bucketLabels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
    const bucketColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

    // Per-question analysis (Google Forms Style)
    const questionAnalysis = questions.map((q: any, qIdx: any) => {
        const qType = q.questionType as string;
        let correctCount = 0;
        const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, ISIAN_CORRECT: 0, ISIAN_WRONG: 0, EMPTY: 0, BS_CORRECT: 0, BS_WRONG: 0 };
        
        // Split options count for B/S
        const bsCounts = [
            { B: 0, S: 0, label: q.optionA },
            { B: 0, S: 0, label: q.optionB },
            { B: 0, S: 0, label: q.optionC },
            { B: 0, S: 0, label: q.optionD },
            { B: 0, S: 0, label: q.optionE }
        ];

        assignments.forEach((assignment: any) => {
            const ans = assignment.answers.find((a: any) => a.questionId === q.id);
            const ansText = ans ? ans.answerText : null;
            const selOpt = ans ? String(ans.selectedOption || '') : '';

            if (qType === 'ISIAN') {
                if (!ansText || ansText.trim() === '') {
                    optionCounts.EMPTY++;
                } else if (ansText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
                    correctCount++;
                    optionCounts.ISIAN_CORRECT++;
                } else {
                    optionCounts.ISIAN_WRONG++;
                }
            } else if (!ans || selOpt === '') {
                optionCounts.EMPTY++;
            } else if (qType === 'BENAR_SALAH') {
                const studentArr = selOpt.split(',');
                const correctArr = String(q.correctAnswer).split(',');
                const optionsArr = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
                
                let isFullCorrect = true;
                optionsArr.forEach((opt, i) => {
                    if (opt && opt.trim() !== '') {
                        const sVal = (studentArr[i] || '').trim();
                        if (sVal === 'B') bsCounts[i].B++;
                        else if (sVal === 'S') bsCounts[i].S++;
                        
                        if (sVal !== (correctArr[i] || '').trim()) isFullCorrect = false;
                    }
                });
                if (isFullCorrect) {
                  correctCount++;
                  optionCounts.BS_CORRECT++;
                } else {
                  optionCounts.BS_WRONG++;
                }
            } else {
                const selected = selOpt.split(',');
                selected.forEach(s => { if (optionCounts[s] !== undefined) optionCounts[s]++; });

                if (qType === 'PGK') {
                    if (String(q.correctAnswer).split(',').sort().join(',') === selOpt.split(',').sort().join(','))
                        correctCount++;
                } else {
                    if (selOpt === q.correctAnswer) correctCount++;
                }
            }
        });

        return {
            index: qIdx,
            questionText: q.questionText as string,
            qType,
            correctCount,
            optionCounts,
            bsCounts,
            correctAnswer: String(q.correctAnswer),
            options: [
                { key: 'A', text: q.optionA },
                { key: 'B', text: q.optionB },
                { key: 'C', text: q.optionC },
                { key: 'D', text: q.optionD },
                { key: 'E', text: q.optionE },
            ].filter(o => o.text && o.text.trim() !== '')
        };
    });

    return (
        <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', paddingBottom: '4rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ backgroundColor: 'white', padding: '1rem 2rem', borderBottom: '1px solid #ddd', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/admin/analytics?pov=package" style={{ textDecoration: 'none', color: '#666', fontSize: '1.25rem' }}>←</Link>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Analisis Tanggapan: {tryoutData.title}</h1>
                </div>
                <Link href={`/api/export/tryout/${tryoutId}`} className="btn btn-primary" style={{ borderRadius: '4px', padding: '0.5rem 1rem' }}>
                    📥 Download Excel
                </Link>
            </header>

            <main style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
                
                {/* Summary Section */}
                <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem', borderRadius: '8px', borderTop: '8px solid #673ab7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '2rem', margin: 0 }}>{totalStudents} tanggapan</h2>
                            <p style={{ color: '#666', margin: '0.25rem 0 0 0' }}>Data dikumpulkan hingga {new Date().toLocaleDateString('id-ID')}</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid #ddd', paddingTop: '1.5rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Rata-rata</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{avg.toFixed(2)} / 100</div>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid #eee', borderRight: '1px solid #eee' }}>
                            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Maksimum</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#2ecc71' }}>{max.toFixed(0)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Minimum</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#e74c3c' }}>{min.toFixed(0)}</div>
                        </div>
                    </div>

                    <div style={{ marginTop: '2.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Distribusi skor</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', paddingBottom: '30px' }}>
                            {buckets.map((count, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ 
                                        width: '100%', maxWidth: '80px', 
                                        height: `${Math.max(2, (count / bucketMax) * 100)}px`, 
                                        backgroundColor: '#673ab7',
                                        borderRadius: '2px 2px 0 0',
                                        opacity: 0.8
                                    }} />
                                    <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 500 }}>{bucketLabels[i]}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>{count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Individual Questions Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {questionAnalysis.map((qa) => {
                        const totalAnswers = totalStudents - (qa.optionCounts.EMPTY || 0);
                        const isCorrectRate = totalStudents > 0 ? (qa.correctCount / totalStudents) * 100 : 0;
                        const isPGK = qa.qType === 'PGK';
                        const isBS = qa.qType === 'BENAR_SALAH';
                        const isIsian = qa.qType === 'ISIAN';

                        return (
                            <div key={qa.index} className="card" style={{ padding: '1.5rem 2rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>Soal {qa.index + 1} dari {questions.length}</div>
                                    <div style={{ fontSize: '0.875rem', color: isCorrectRate >= 50 ? '#2ecc71' : '#e67e22', fontWeight: 600 }}>
                                        {isCorrectRate.toFixed(1)}% Benar
                                    </div>
                                </div>
                                
                                <div style={{ fontSize: '1.125rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                    <MathText text={qa.questionText} />
                                </div>

                                {/* Charts Area */}
                                {isIsian ? (
                                    <div style={{ marginTop: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ flex: 1, height: '24px', backgroundColor: '#e8f5e9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${(qa.optionCounts.ISIAN_CORRECT / totalStudents) * 100}%`, height: '100%', backgroundColor: '#4caf50' }} />
                                                </div>
                                                <span style={{ fontSize: '0.875rem', minWidth: '80px' }}>{qa.optionCounts.ISIAN_CORRECT} Benar</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ flex: 1, height: '24px', backgroundColor: '#ffebee', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${(qa.optionCounts.ISIAN_WRONG / totalStudents) * 100}%`, height: '100%', backgroundColor: '#f44336' }} />
                                                </div>
                                                <span style={{ fontSize: '0.875rem', minWidth: '80px' }}>{qa.optionCounts.ISIAN_WRONG} Salah</span>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #eee' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>KUNCI JAWABAN:</div>
                                            <span style={{ fontWeight: 600, color: '#2e7d32' }}>{qa.correctAnswer}</span>
                                        </div>
                                    </div>
                                ) : isBS ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {qa.bsCounts.map((bs, i) => {
                                            if (!bs.label) return null;
                                            const correctArr = qa.correctAnswer.split(',');
                                            const correctVal = (correctArr[i] || 'B').trim();
                                            const totalBS = bs.B + bs.S;
                                            const bPerc = totalBS > 0 ? (bs.B / totalBS) * 100 : 0;
                                            const sPerc = totalBS > 0 ? (bs.S / totalBS) * 100 : 0;

                                            return (
                                                <div key={i} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '6px' }}>
                                                    <div style={{ marginBottom: '0.75rem', fontWeight: 500 }}><MathText text={bs.label} /></div>
                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                                <span>Benar {correctVal === 'B' && '✅'}</span>
                                                                <span>{bs.B} ({bPerc.toFixed(1)}%)</span>
                                                            </div>
                                                            <div style={{ height: '8px', backgroundColor: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${bPerc}%`, height: '100%', backgroundColor: '#2196f3' }} />
                                                            </div>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                                <span>Salah {correctVal === 'S' && '✅'}</span>
                                                                <span>{bs.S} ({sPerc.toFixed(1)}%)</span>
                                                            </div>
                                                            <div style={{ height: '8px', backgroundColor: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${sPerc}%`, height: '100%', backgroundColor: '#ff9800' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {qa.options.map(opt => {
                                            const count = qa.optionCounts[opt.key] || 0;
                                            const perc = totalStudents > 0 ? (count / totalStudents) * 100 : 0;
                                            const isCorrect = isPGK ? qa.correctAnswer.split(',').includes(opt.key) : qa.correctAnswer === opt.key;
                                            
                                            return (
                                                <div key={opt.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                            <span style={{ fontWeight: 600 }}>{opt.key}.</span>
                                                            <div style={{ color: isCorrect ? '#2e7d32' : 'inherit', fontWeight: isCorrect ? 600 : 400 }}>
                                                                <MathText text={opt.text!} />
                                                                {isCorrect && <span style={{ marginLeft: '0.5rem' }}>✅</span>}
                                                            </div>
                                                        </div>
                                                        <span style={{ color: '#666', minWidth: '60px', textAlign: 'right' }}>{count}</span>
                                                    </div>
                                                    <div style={{ height: '24px', backgroundColor: '#f1f3f4', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                                                        <div style={{ 
                                                            width: `${perc}%`, 
                                                            height: '100%', 
                                                            backgroundColor: isCorrect ? '#4caf50' : '#1a73e8',
                                                            opacity: isCorrect ? 0.8 : 0.6
                                                        }} />
                                                        <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 600, color: perc > 90 ? '#fff' : '#666' }}>{perc.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                
                                {qa.optionCounts.EMPTY > 0 && (
                                    <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
                                        * {qa.optionCounts.EMPTY} peserta melompati soal ini
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
