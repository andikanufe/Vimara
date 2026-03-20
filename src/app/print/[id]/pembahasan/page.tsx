import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import MathText from '@/components/MathText';
import PrintClientHelper, { PrintWatermark } from '../PrintClientHelper';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const tryoutId = (await params).id;
    const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
    if (!tryoutDoc.exists) return { title: 'Print Pembahasan' };
    const data = tryoutDoc.data()!;
    return { title: `Pembahasan - ${data.title}` };
}

export default async function PrintPembahasanPage({ params }: { params: Promise<{ id: string }> }) {
    const tryoutId = (await params).id;
    const session = await getSession();
    if (!session) return redirect('/');

    // Check if student has score > 70
    const assignmentSnap = await db.collection('assignments')
        .where('studentId', '==', session.id)
        .where('tryoutId', '==', tryoutId)
        .where('status', '==', 'COMPLETED')
        .get();

    if (assignmentSnap.empty) return notFound();
    const assignment = assignmentSnap.docs[0].data();
    if (Number(assignment.score || 0) <= 70) return redirect(`/student/tryouts/${tryoutId}/result`);

    const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
    if (!tryoutDoc.exists) return notFound();
    const tryoutData = tryoutDoc.data()!;

    let packageName = 'Paket';
    if (tryoutData.categoryId) {
        const catDoc = await db.collection('packageCategories').doc(tryoutData.categoryId).get();
        if (catDoc.exists) packageName = catDoc.data()!.name;
    }

    const safeFileName = `Pembahasan-${packageName}-${tryoutData.category}-${tryoutData.title}`.replace(/[^a-zA-Z0-9 -]/g, '_');

    const questionsSnap = await db.collection('questions').where('tryoutId', '==', tryoutId).get();
    let questions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    questions.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
    });

    return (
        <div id="printable-area" style={{ backgroundColor: 'white', color: 'black', fontFamily: 'sans-serif', fontSize: '12px', width: '100%' }}>
            <PrintClientHelper fileName={safeFileName} />

            {/* Minimalist Header for Print Efficiency */}
            <div style={{ paddingBottom: '0.75rem', borderBottom: '2px solid #000', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.1rem 0', color: '#000' }}>Pembahasan</h1>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>
                        {tryoutData.title} <span style={{ margin: '0 0.3rem' }}>•</span> {tryoutData.category}
                    </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <img src="/vimara-logo.svg" alt="Vimara Logo" style={{ height: '24px', objectFit: 'contain', marginBottom: '4px' }} className="print-logo" />
                    <PrintWatermark userName={session?.name} userEmail={session?.username} />
                </div>
            </div>

            {/* Questions with Answers and Pembahasan */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '0 1.5rem 1.5rem 1.5rem' }}>
                {questions.map((q: any, idx) => {
                    const qType = q.questionType as string;
                    const correctAnsStr = String(q.correctAnswer);

                    return (
                        <div key={q.id} className="question-block" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                            {/* Question */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 800, minWidth: '20px', color: '#2563eb' }}>{idx + 1}.</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ lineHeight: 1.5, marginBottom: '0.75rem' }}>
                                        <MathText text={q.questionText as string} />
                                    </div>

                                    {/* Options rendering */}
                                    <div className="options-block">
                                        {qType === 'ISIAN' ? (
                                            <div style={{ fontSize: '0.8rem', paddingLeft: '0.5rem', borderLeft: '2px solid #22c55e', marginBottom: '0.75rem' }}>
                                                Kunci Jawaban: <strong>{correctAnsStr}</strong>
                                            </div>
                                        ) : qType === 'BENAR_SALAH' ? (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                                        <th style={{ padding: '0.3rem', border: '1px solid #cbd5e1', textAlign: 'left' }}>Pernyataan</th>
                                                        <th style={{ padding: '0.3rem', border: '1px solid #cbd5e1', width: '60px', textAlign: 'center' }}>Kunci</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {['A', 'B', 'C', 'D', 'E'].map((opt, i) => {
                                                        const optText = q[`option${opt}`] as string | null;
                                                        if (!optText) return null;
                                                        const cAns = correctAnsStr.split(',')[i] || '-';
                                                        return (
                                                            <tr key={opt}>
                                                                <td style={{ padding: '0.3rem', border: '1px solid #cbd5e1' }}><MathText text={optText} /></td>
                                                                <td style={{ padding: '0.3rem', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{cAns === 'B' ? 'Benar' : cAns === 'S' ? 'Salah' : cAns}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                    const optText = q[`option${opt}`];
                                                    if (!optText) return null;
                                                    const isKey = correctAnsStr.split(',').includes(opt);
                                                    return (
                                                        <div key={opt} style={{
                                                            display: 'flex', gap: '0.4rem', alignItems: 'flex-start',
                                                            padding: '0.2rem 0.4rem', borderRadius: '4px',
                                                            backgroundColor: isKey ? '#eff6ff' : 'transparent',
                                                            border: isKey ? '1px solid #bfdbfe' : '1px solid transparent'
                                                        }}>
                                                            <span style={{ minWidth: '16px', fontWeight: 700, color: isKey ? '#1d4ed8' : '#475569' }}>{opt}.</span>
                                                            <span style={{ flex: 1 }}><MathText text={optText as string} /></span>
                                                            {isKey && <span style={{ color: '#1d4ed8', fontWeight: 800, fontSize: '0.75rem', paddingLeft: '0.5rem' }}>✓ Kunci Jawaban</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Pembahasan */}
                                    {q.pembahasan && (
                                        <div className="pembahasan-block" style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderLeft: '3px solid #3b82f6', borderRadius: '0 4px 4px 0', fontSize: '0.85rem', lineHeight: 1.6 }}>
                                            <div style={{ fontWeight: 800, color: '#1d4ed8', marginBottom: '0.4rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span>📖</span> Pembahasan
                                            </div>
                                            <MathText text={q.pembahasan as string} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
