import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import MathText from '@/components/MathText';

export default async function AnalyticsPage() {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return redirect('/');

    const tryouts = await prisma.tryout.findMany({
        include: {
            questions: { orderBy: { createdAt: 'asc' } },
            assignments: {
                where: { status: 'COMPLETED' },
                include: { answers: true, student: true }
            },
            _count: { select: { assignments: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>📊 Analisis Butir Soal</h1>
                <p>Statistik dan analisis per paket tryout</p>
            </div>

            {tryouts.length === 0 && <div className="empty-state">Belum ada tryout.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {tryouts.map(tryout => {
                    const completed = tryout.assignments;
                    const scores = completed.map(a => a.score || 0);
                    const totalStudents = completed.length;

                    if (totalStudents === 0) {
                        return (
                            <div key={tryout.id} className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{tryout.title}</h2>
                                        <span className="badge badge-primary">{tryout.category}</span>
                                    </div>
                                    <div className="text-muted text-sm">Belum ada siswa yang menyelesaikan</div>
                                </div>
                            </div>
                        );
                    }

                    const avg = scores.reduce((a, b) => a + b, 0) / totalStudents;
                    const min = Math.min(...scores);
                    const max = Math.max(...scores);
                    const stdDev = Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / totalStudents);

                    // Score distribution buckets
                    const buckets = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
                    scores.forEach(s => {
                        if (s <= 20) buckets[0]++;
                        else if (s <= 40) buckets[1]++;
                        else if (s <= 60) buckets[2]++;
                        else if (s <= 80) buckets[3]++;
                        else buckets[4]++;
                    });
                    const bucketMax = Math.max(...buckets, 1);
                    const bucketLabels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
                    const bucketColors = ['var(--danger)', '#f97316', 'var(--warning)', '#84cc16', 'var(--success)'];

                    // Per-question analysis
                    const questionAnalysis = tryout.questions.map((q, qIdx) => {
                        const qType = (q as Record<string, unknown>).questionType as string;
                        let correctCount = 0;
                        const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, ISIAN_CORRECT: 0, ISIAN_WRONG: 0, EMPTY: 0 };

                        // Upper/lower group for discrimination
                        const sortedAssignments = [...completed].sort((a, b) => (b.score || 0) - (a.score || 0));
                        const groupSize = Math.max(1, Math.floor(totalStudents * 0.27));
                        const upperGroup = sortedAssignments.slice(0, groupSize);
                        const lowerGroup = sortedAssignments.slice(-groupSize);
                        let upperCorrect = 0;
                        let lowerCorrect = 0;

                        completed.forEach(assignment => {
                            const ans = assignment.answers.find(a => a.questionId === q.id);
                            const ansText = ans ? (ans as Record<string, unknown>).answerText as string | null : null;

                            if (qType === 'ISIAN') {
                                if (!ansText || ansText.trim() === '') {
                                    optionCounts.EMPTY++;
                                } else if (ansText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
                                    correctCount++;
                                    optionCounts.ISIAN_CORRECT++;
                                } else {
                                    optionCounts.ISIAN_WRONG++;
                                }
                            } else if (!ans?.selectedOption) {
                                optionCounts.EMPTY++;
                            } else {
                                const selected = ans.selectedOption.split(',');
                                selected.forEach(s => { if (optionCounts[s] !== undefined) optionCounts[s]++; });

                                if (qType === 'PGK') {
                                    if (q.correctAnswer.split(',').sort().join(',') === ans.selectedOption.split(',').sort().join(','))
                                        correctCount++;
                                } else {
                                    if (ans.selectedOption === q.correctAnswer) correctCount++;
                                }
                            }
                        });

                        // Discrimination index
                        upperGroup.forEach(a => {
                            const ans = a.answers.find(x => x.questionId === q.id);
                            const ansText = ans ? (ans as Record<string, unknown>).answerText as string | null : null;
                            if (qType === 'ISIAN') {
                                if (ansText && ansText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) upperCorrect++;
                            } else if (ans?.selectedOption) {
                                if (qType === 'PGK') {
                                    if (q.correctAnswer.split(',').sort().join(',') === ans.selectedOption.split(',').sort().join(',')) upperCorrect++;
                                } else {
                                    if (ans.selectedOption === q.correctAnswer) upperCorrect++;
                                }
                            }
                        });

                        lowerGroup.forEach(a => {
                            const ans = a.answers.find(x => x.questionId === q.id);
                            const ansText = ans ? (ans as Record<string, unknown>).answerText as string | null : null;
                            if (qType === 'ISIAN') {
                                if (ansText && ansText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) lowerCorrect++;
                            } else if (ans?.selectedOption) {
                                if (qType === 'PGK') {
                                    if (q.correctAnswer.split(',').sort().join(',') === ans.selectedOption.split(',').sort().join(',')) lowerCorrect++;
                                } else {
                                    if (ans.selectedOption === q.correctAnswer) lowerCorrect++;
                                }
                            }
                        });

                        const difficulty = totalStudents > 0 ? correctCount / totalStudents : 0;
                        const discrimination = groupSize > 0 ? (upperCorrect - lowerCorrect) / groupSize : 0;

                        let difficultyLabel = '';
                        let difficultyColor = '';
                        if (difficulty >= 0.7) { difficultyLabel = 'Mudah'; difficultyColor = 'var(--success)'; }
                        else if (difficulty >= 0.3) { difficultyLabel = 'Sedang'; difficultyColor = 'var(--warning)'; }
                        else { difficultyLabel = 'Sulit'; difficultyColor = 'var(--danger)'; }

                        let discLabel = '';
                        let discColor = '';
                        if (discrimination >= 0.4) { discLabel = 'Baik'; discColor = 'var(--success)'; }
                        else if (discrimination >= 0.2) { discLabel = 'Cukup'; discColor = 'var(--warning)'; }
                        else { discLabel = 'Buruk'; discColor = 'var(--danger)'; }

                        const needsReview = difficulty < 0.1 || difficulty > 0.9 || discrimination < 0.2;

                        return {
                            index: qIdx,
                            questionText: q.questionText,
                            qType,
                            difficulty,
                            difficultyLabel,
                            difficultyColor,
                            discrimination,
                            discLabel,
                            discColor,
                            optionCounts,
                            needsReview,
                            correctAnswer: q.correctAnswer,
                        };
                    });

                    const flaggedCount = questionAnalysis.filter(q => q.needsReview).length;

                    return (
                        <div key={tryout.id} className="card" style={{ padding: 0 }}>
                            {/* Header */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                                        <span className="badge badge-primary">{tryout.category}</span>
                                        <span className="badge badge-muted">{tryout.questions.length} soal</span>
                                        {flaggedCount > 0 && <span className="badge badge-danger">⚠ {flaggedCount} perlu review</span>}
                                    </div>
                                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{tryout.title}</h2>
                                </div>
                                <Link href={`/api/export/tryout/${tryout.id}`} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
                                    📥 Export Excel
                                </Link>
                            </div>

                            {/* Summary Stats */}
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <div>
                                    <div className="text-xs text-muted">Peserta Selesai</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalStudents}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted">Rata-rata</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{avg.toFixed(1)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted">Min / Max</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{min.toFixed(0)} / {max.toFixed(0)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted">Std Deviasi</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stdDev.toFixed(1)}</div>
                                </div>
                            </div>

                            {/* Score Distribution */}
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
                                <div className="text-xs text-muted font-bold" style={{ marginBottom: '0.75rem' }}>Distribusi Skor</div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                                    {buckets.map((count, i) => (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <div className="text-xs font-semibold" style={{ color: count > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{count}</div>
                                            <div style={{
                                                width: '100%', maxWidth: '48px',
                                                height: `${Math.max(4, (count / bucketMax) * 60)}px`,
                                                backgroundColor: bucketColors[i],
                                                borderRadius: '3px 3px 0 0',
                                                transition: 'height 0.3s',
                                                opacity: count > 0 ? 1 : 0.3,
                                            }} />
                                            <div className="text-xs text-muted" style={{ fontSize: '0.625rem' }}>{bucketLabels[i]}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Item Analysis Table */}
                            <div style={{ padding: '1rem 1.5rem' }}>
                                <div className="text-xs text-muted font-bold" style={{ marginBottom: '0.75rem' }}>Analisis Per Butir Soal</div>
                                <div className="table-wrap">
                                    <table style={{ fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>No</th>
                                                <th>Soal</th>
                                                <th>Tipe</th>
                                                <th style={{ textAlign: 'center' }}>Tingkat Kesulitan</th>
                                                <th style={{ textAlign: 'center' }}>Daya Beda</th>
                                                <th style={{ textAlign: 'center' }}>Distribusi</th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {questionAnalysis.map(qa => (
                                                <tr key={qa.index} style={{ backgroundColor: qa.needsReview ? 'var(--danger-light)' : undefined }}>
                                                    <td style={{ fontWeight: 600 }}>{qa.index + 1}</td>
                                                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        <MathText text={qa.questionText.substring(0, 60) + (qa.questionText.length > 60 ? '...' : '')} />
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${qa.qType === 'PGK' ? 'badge-warning' : qa.qType === 'ISIAN' ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: '0.625rem' }}>
                                                            {qa.qType}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                                            <div style={{ width: '40px', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${qa.difficulty * 100}%`, height: '100%', backgroundColor: qa.difficultyColor, borderRadius: '3px' }} />
                                                            </div>
                                                            <span className="text-xs" style={{ color: qa.difficultyColor, fontWeight: 600 }}>
                                                                {(qa.difficulty * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-muted">{qa.difficultyLabel}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className="text-xs font-semibold" style={{ color: qa.discColor }}>
                                                            {qa.discrimination.toFixed(2)}
                                                        </span>
                                                        <div className="text-xs text-muted">{qa.discLabel}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {qa.qType === 'ISIAN' ? (
                                                            <div className="text-xs">
                                                                <span style={{ color: 'var(--success)' }}>✓{qa.optionCounts.ISIAN_CORRECT}</span>
                                                                {' '}
                                                                <span style={{ color: 'var(--danger)' }}>✗{qa.optionCounts.ISIAN_WRONG}</span>
                                                                {' '}
                                                                <span className="text-muted">−{qa.optionCounts.EMPTY}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs" style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                                                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                                    if (qa.optionCounts[opt] === 0 && opt === 'E') return null;
                                                                    const isCorrect = qa.correctAnswer.split(',').includes(opt);
                                                                    return (
                                                                        <span key={opt} style={{
                                                                            padding: '1px 4px', borderRadius: '3px', fontSize: '0.625rem',
                                                                            backgroundColor: isCorrect ? 'var(--success-light)' : 'var(--bg-color)',
                                                                            color: isCorrect ? 'var(--success)' : 'var(--text-muted)',
                                                                            fontWeight: isCorrect ? 700 : 400,
                                                                        }}>
                                                                            {opt}:{qa.optionCounts[opt]}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>{qa.needsReview && <span title="Perlu review">⚠️</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
