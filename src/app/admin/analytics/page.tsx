import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PackageSelector from './PackageSelector';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ packageId?: string, pov?: string }> }) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') return redirect('/');

    const sParams = await searchParams;
    if (sParams.pov === 'student') return redirect('/admin/students');
    if (sParams.pov === 'package') return redirect('/admin/analytics');

    const tryoutsSnap = await db.collection('tryouts').orderBy('createdAt', 'desc').get();
    const allTryouts = tryoutsSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title || 'Untitled' }));

    if (allTryouts.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Belum ada paket soal</h2>
                <p style={{ color: 'var(--text-secondary, #666)', fontSize: '14px' }}>Buat paket soal terlebih dahulu di menu Paket Soal.</p>
            </div>
        );
    }

    const packageId = sParams.packageId || allTryouts[0].id;
    const tryoutDoc = await db.collection('tryouts').doc(packageId).get();
    if (!tryoutDoc.exists) return redirect('/admin/analytics');
    const tryoutData = tryoutDoc.data()!;

    const [assignmentsSnap, questionsSnap] = await Promise.all([
        db.collection('assignments').where('tryoutId', '==', packageId).where('status', '==', 'COMPLETED').get(),
        db.collection('questions').where('tryoutId', '==', packageId).get()
    ]);

    // Fetch assignments, excluding the demo account (email contains demo123)
    const allAssignmentsRaw = await Promise.all(assignmentsSnap.docs.map(async (aDoc) => {
        const a = aDoc.data();
        // Lookup user to check if it's the demo account
        const userDoc = await db.collection('users').doc(a.studentId as string).get();
        const userEmail: string = userDoc.exists ? (userDoc.data()?.email || '') : '';
        const userName: string = userDoc.exists ? (userDoc.data()?.name || '') : '';
        const isDemo = userEmail.toLowerCase().includes('demo') || userName.toLowerCase().includes('demo');
        if (isDemo) return null; // Exclude all demo accounts

        const ansSnap = await db.collection('answers').where('assignmentId', '==', aDoc.id).get();
        return {
            id: aDoc.id,
            studentId: a.studentId,
            score: Number(a.score) || 0,
            violationCount: a.violationCount || 0,
            answers: ansSnap.docs.map(ans => ({ id: ans.id, ...ans.data() }))
        };
    }));
    const assignments = allAssignmentsRaw.filter(Boolean) as { id: string, studentId: string, score: number, violationCount: number, answers: any[] }[];

    const questions = questionsSnap.docs.map(doc => {
        const data = doc.data() as any;
        return { id: doc.id, ...data };
    }).sort((a, b) => ((a.createdAt as any)?.toMillis?.() || 0) - ((b.createdAt as any)?.toMillis?.() || 0));

    // Analytics calculations
    const totalParticipants = assignments.length;
    const scores = assignments.map(a => a.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passCount = scores.filter(s => s >= 70).length;
    
    let difficultyLabel = '–';
    let difficultyColor = 'var(--text-secondary, #888)';
    if (scores.length > 0) {
        if (avgScore > 80) { difficultyLabel = 'Mudah'; difficultyColor = '#16a34a'; }
        else if (avgScore >= 60) { difficultyLabel = 'Sedang'; difficultyColor = '#d97706'; }
        else { difficultyLabel = 'Sulit'; difficultyColor = '#dc2626'; }
    }

    // Score distribution
    const buckets = [0, 0, 0, 0, 0];
    scores.forEach(s => {
        if (s <= 20) buckets[0]++;
        else if (s <= 40) buckets[1]++;
        else if (s <= 60) buckets[2]++;
        else if (s <= 80) buckets[3]++;
        else buckets[4]++;
    });
    const bucketMax = Math.max(...buckets, 1);
    const bucketLabels = ['0–20', '21–40', '41–60', '61–80', '81–100'];

    // Top performers
    const sortedAssignments = [...assignments].sort((a, b) => b.score - a.score).slice(0, 5);
    const topPerformers = await Promise.all(sortedAssignments.map(async (a, index) => {
        const userDoc = await db.collection('users').doc(a.studentId).get();
        return {
            ...a,
            rank: index + 1,
            studentName: userDoc.exists ? userDoc.data()?.name || 'Tidak diketahui' : 'Anonim',
        };
    }));

    // Question analysis — mirrors the scoring logic in /api/tryout/finish/route.ts
    const questionAnalysis = questions.map((q, qIdx) => {
        const qType = q.questionType as string;
        let correctCount = 0;
        let emptyCount = 0;

        assignments.forEach(assignment => {
            const ans = assignment.answers.find((a: any) => a.questionId === q.id);

            if (!ans) {
                emptyCount++;
                return;
            }

            const selOpt = String((ans as any).selectedOption ?? '');
            const ansText = String((ans as any).answerText ?? '');
            const hasAnswer = selOpt.trim() !== '' || ansText.trim() !== '';

            if (!hasAnswer) {
                emptyCount++;
                return;
            }

            // Match exactly the logic used in finish/route.ts
            if (qType === 'ISIAN') {
                // ISIAN uses answerText, not selectedOption
                if (ansText.trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()) correctCount++;
            } else if (qType === 'BENAR_SALAH') {
                const options = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE];
                const lastIdx = options.reduce((acc: number, opt: any, i: number) => (opt && opt.trim() !== '' ? i : acc), 0);
                const correctArr = String(q.correctAnswer || '').split(',').slice(0, lastIdx + 1);
                const studentArr = selOpt.split(',').slice(0, lastIdx + 1);
                if (correctArr.join(',') === studentArr.join(',')) correctCount++;
            } else if (qType === 'PGK') {
                const correctSet = String(q.correctAnswer || '').split(',').sort().join(',');
                const studentSet = selOpt.split(',').sort().join(',');
                if (correctSet === studentSet) correctCount++;
            } else {
                // PILIHAN_GANDA and any other type
                if (selOpt === String(q.correctAnswer || '')) correctCount++;
            }
        });
        
        const rate = totalParticipants > 0 ? (correctCount / totalParticipants) * 100 : 0;
        return {
            index: qIdx + 1,
            id: q.id as string,
            text: q.questionText || '',
            rate,
            isCritical: rate < 40 && totalParticipants > 0,
            isHigh: rate > 80 && totalParticipants > 0,
        };
    });


    const criticalCount = questionAnalysis.filter(q => q.isCritical).length;
    const highCount = questionAnalysis.filter(q => q.isHigh).length;
    const midCount = questionAnalysis.length - criticalCount - highCount;

    return (
        <div style={{ paddingTop: '8px' }}>

            {/* Page Header */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #111)', margin: 0 }}>Analisis Hasil Tryout</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary, #666)', marginTop: '4px' }}>Ringkasan performa peserta dan kualitas soal</p>
                </div>
                <div style={{ width: '220px', flexShrink: 0 }}>
                    <PackageSelector tryouts={allTryouts} selectedId={packageId} />
                </div>
            </div>

            {/* Package Banner */}
            <div className="card" style={{ padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '22px' }}>📋</div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #111)' }}>{tryoutData.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>
                        {questions.length} soal · {tryoutData.duration || '?'} menit
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #111)' }}>{totalParticipants}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary, #888)' }}>Peserta</div>
                    </div>
                    <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border, #e5e7eb)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: difficultyColor }}>{difficultyLabel}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary, #888)' }}>Kesulitan</div>
                    </div>
                    <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border, #e5e7eb)' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>
                            {totalParticipants > 0 ? Math.round((passCount / totalParticipants) * 100) : 0}%
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary, #888)' }}>Lulus (≥70)</div>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px' }}>Rata-rata Nilai</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary, #111)', lineHeight: 1 }}>{avgScore.toFixed(1)}</div>
                </div>
                <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px' }}>Tertinggi / Terendah</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #111)', lineHeight: 1 }}>
                        <span style={{ color: '#16a34a' }}>{maxScore.toFixed(0)}</span>
                        <span style={{ color: 'var(--text-secondary, #ccc)', fontSize: '14px', margin: '0 4px' }}>/</span>
                        <span style={{ color: '#dc2626' }}>{minScore.toFixed(0)}</span>
                    </div>
                </div>
                <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px' }}>Peserta Lulus</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', lineHeight: 1 }}>{passCount}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '3px' }}>dari {totalParticipants}</div>
                </div>
                <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginBottom: '4px' }}>Soal Bermasalah</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: criticalCount > 0 ? '#dc2626' : 'var(--text-primary, #111)', lineHeight: 1 }}>{criticalCount}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #888)', marginTop: '3px' }}>tingkat benar &lt;40%</div>
                </div>
            </div>

            {/* Distribution + Top Performers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', marginBottom: '16px' }}>

                {/* Score Distribution */}
                <div className="card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)', marginBottom: '4px' }}>Distribusi Nilai</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '20px' }}>Sebaran nilai peserta yang telah menyelesaikan tryout</div>
                    {totalParticipants > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px', borderBottom: '1px solid var(--border-light, #f3f4f6)', paddingBottom: '8px' }}>
                            {buckets.map((count, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px', position: 'relative' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary, #111)', visibility: count > 0 ? 'visible' : 'hidden' }}>{count}</span>
                                    <div
                                        style={{
                                            width: '100%',
                                            height: `${(count / bucketMax) * 100}%`,
                                            minHeight: count > 0 ? '4px' : '0',
                                            backgroundColor: 'var(--primary, #2563eb)',
                                            borderRadius: '4px 4px 0 0',
                                            opacity: 0.7 + (count / bucketMax) * 0.3
                                        }}
                                    />
                                    <span style={{ position: 'absolute', bottom: '-20px', fontSize: '10px', color: 'var(--text-secondary, #888)', whiteSpace: 'nowrap' }}>{bucketLabels[i]}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
                            Belum ada peserta yang menyelesaikan tryout.
                        </div>
                    )}
                </div>

                {/* Top Performers */}
                <div className="card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)', marginBottom: '12px' }}>Nilai Terbaik</div>
                    {topPerformers.length > 0 ? (
                        <div>
                            {topPerformers.map((p) => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: p.rank === 1 ? 'var(--primary, #2563eb)' : 'var(--border-light, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: p.rank === 1 ? '#fff' : 'var(--text-secondary, #888)', flexShrink: 0 }}>
                                        {p.rank}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.studentName}</div>
                                        {p.violationCount > 0 && (
                                            <span style={{ fontSize: '10px', backgroundColor: 'var(--danger, #ef4444)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }} title={`${p.violationCount} Indikasi Kecurangan`}>
                                                ⚠️ {p.violationCount}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: p.rank === 1 ? 'var(--primary, #2563eb)' : 'var(--text-primary, #111)', flexShrink: 0 }}>
                                        {p.score.toFixed(0)}
                                    </div>
                                </div>
                            ))}

                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
                            Belum ada data nilai.
                        </div>
                    )}
                </div>
            </div>

            {/* Question Analysis */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light, #f3f4f6)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)' }}>Analisis Per Soal</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>Persentase peserta yang menjawab benar setiap soal</div>
                </div>

                {/* Legend */}
                {totalParticipants > 0 && questionAnalysis.length > 0 && (
                    <div style={{ padding: '10px 16px', backgroundColor: 'var(--border-light, #fafafa)', borderBottom: '1px solid var(--border-light, #f3f4f6)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary, #666)' }}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
                            {criticalCount} soal perlu perhatian <span style={{ color: '#999' }}>(&lt;40%)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary, #666)' }}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                            {midCount} soal cukup <span style={{ color: '#999' }}>(40–80%)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary, #666)' }}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                            {highCount} soal dikuasai <span style={{ color: '#999' }}>(&#62;80%)</span>
                        </div>
                    </div>
                )}

                {/* Questions Table */}
                <div>
                    {questionAnalysis.map(q => {
                        const plainText = q.text
                            .replace(/```[\s\S]*?```/g, '') // strip code fences
                            .replace(/`[^`]*`/g, '')       // strip inline code
                            .replace(/\[.*?\]\(.*?\)/g, '') // strip markdown links
                            .replace(/<[^>]*>?/gm, ' ')    // strip HTML tags
                            .replace(/\$\$[\s\S]*?\$\$/g, '') // strip LaTeX block
                            .replace(/\$[^$]*\$/g, '')     // strip LaTeX inline
                            .replace(/\s+/g, ' ').trim();
                        const truncated = plainText.length > 100 ? plainText.substring(0, 100) + '…' : plainText;
                        const barColor = q.isCritical ? '#dc2626' : q.isHigh ? '#16a34a' : '#f59e0b';
                        const labelColor = q.isCritical ? '#dc2626' : q.isHigh ? '#16a34a' : '#d97706';
                        const label = q.isCritical ? 'Perlu Perbaikan' : q.isHigh ? 'Dikuasai' : 'Cukup';

                        return (
                            <div key={q.index} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border-light, #f9fafb)' }}>
                                {/* No */}
                                <div style={{ width: '28px', fontSize: '12px', color: 'var(--text-secondary, #999)', fontWeight: 500, flexShrink: 0, textAlign: 'center' }}>
                                    {q.index}
                                </div>

                                {/* Question text */}
                                <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-primary, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {truncated || <span style={{ color: 'var(--text-secondary, #999)', fontStyle: 'italic' }}>Teks soal kosong</span>}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div style={{ width: '120px', flexShrink: 0 }}>
                                    <div style={{ height: '6px', backgroundColor: 'var(--border-light, #f3f4f6)', borderRadius: '99px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', borderRadius: '99px', backgroundColor: barColor, width: `${Math.max(1, q.rate)}%`, transition: 'width 0.3s ease' }} />
                                    </div>
                                </div>

                                {/* Rate + label */}
                                <div style={{ width: '110px', flexShrink: 0, textAlign: 'right' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: labelColor }}>{q.rate.toFixed(0)}%</span>
                                    <div style={{ fontSize: '10px', color: labelColor, marginTop: '2px' }}>{label}</div>
                                </div>

                                {/* Edit Button */}
                                <div style={{ flexShrink: 0, marginLeft: '4px' }}>
                                    <Link 
                                        href={`/admin/tryouts/${packageId}`} 
                                        className="btn btn-outline" 
                                        style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-secondary, #666)' }}
                                        title="Edit di paket soal"
                                    >
                                        Edit
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                    {questionAnalysis.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary, #888)', fontSize: '13px' }}>
                            Belum ada soal pada paket ini.
                        </div>
                    )}
                </div>

                {/* Conclusion */}
                {totalParticipants > 0 && questionAnalysis.length > 0 && (
                    <div style={{ padding: '14px 16px', backgroundColor: 'var(--border-light, #fafafa)', borderTop: '1px solid var(--border-light, #f3f4f6)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary, #555)', lineHeight: 1.6, margin: 0 }}>
                            <strong>Kesimpulan:</strong>{' '}
                            {criticalCount === 0
                                ? `Semua soal memiliki tingkat pemahaman yang baik (≥40%). ${highCount > 0 ? `${highCount} soal bahkan dikuasai sangat baik oleh peserta (>80% benar).` : ''}`
                                : `Ada ${criticalCount} soal dengan tingkat jawaban benar di bawah 40%. Soal-soal ini perlu ditinjau ulang atau materinya perlu diperkuat kembali sebelum tryout berikutnya.`
                            }
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}
