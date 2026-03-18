import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/firebase-admin';
import { getSession } from '@/lib/auth';
import MathText from '@/components/MathText';
import PrintClientHelper, { PrintWatermark } from './PrintClientHelper';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const tryoutId = (await params).id;
    const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
    if (!tryoutDoc.exists) return { title: 'Print Tryout' };
    const data = tryoutDoc.data()!;

    // Format: [Nama Ujian] - [Kategori] - [Paket]
    let title = `${data.title} - ${data.category}`;
    if (data.categoryId) {
        const catDoc = await db.collection('packageCategories').doc(data.categoryId).get();
        if (catDoc.exists) {
            title += ` - ${catDoc.data()!.name}`;
        }
    }

    return { title };
}

export default async function PrintTryoutPage({ params }: { params: Promise<{ id: string }> }) {
    const tryoutId = (await params).id;
    const session = await getSession();
    if (!session) return redirect('/');

    const tryoutDoc = await db.collection('tryouts').doc(tryoutId).get();
    if (!tryoutDoc.exists) return notFound();
    const tryoutData = tryoutDoc.data()!;

    const questionsSnap = await db.collection('questions')
        .where('tryoutId', '==', tryoutId)
        .get();

    let questionsData = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (tryoutData.randomizeQuestions) {
        // Fisher-Yates Shuffle
        for (let i = questionsData.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questionsData[i], questionsData[j]] = [questionsData[j], questionsData[i]];
        }
    } else {
        // Sort by createdAt (default sequential order)
        questionsData.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateA.getTime() - dateB.getTime();
        });
    }

    const questions = questionsData;

    return (
        <div id="printable-area" style={{ backgroundColor: 'white', color: 'black', fontFamily: 'sans-serif', fontSize: '11px', width: '100%' }}>
            <PrintClientHelper tryoutId={tryoutId} />

            {/* Header / Vimara Blue Theme */}
            <div style={{ padding: '1rem 1.25rem', backgroundColor: '#eff6ff', borderBottom: '2px solid #bfdbfe', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.2rem 0', color: '#1e3a8a', letterSpacing: '-0.5px' }}>Lembar Belajar Siswa</h1>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1d4ed8' }}>
                        {tryoutData.title} <span style={{ color: '#93c5fd', margin: '0 0.3rem' }}>•</span> {tryoutData.category}
                    </div>
                    <PrintWatermark userName={session?.name} userEmail={session?.username} />
                </div>
                <div style={{ textAlign: 'right' }}>
                    <img src="/vimara-logo.svg" alt="Vimara Logo" style={{ height: '32px', objectFit: 'contain' }} />
                </div>
            </div>

            {/* Two Column Layout for Questions */}
            <div style={{ columns: '2', columnGap: '1.25rem', padding: '0 1.25rem 1rem 1.25rem' }}>
                {questions.map((q: any, idx) => {
                    const qType = q.questionType as string;
                    const imgUrl = q.imageUrl as string | null;

                    return (
                        <div key={q.id} style={{ breakInside: 'avoid', marginBottom: '0.75rem', pageBreakInside: 'avoid' }}>
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 'bold', minWidth: '16px' }}>{idx + 1}.</div>
                                <div style={{ flex: 1 }}>
                                    {imgUrl && (
                                        <div style={{ marginBottom: '0.4rem', display: 'flex', justifyContent: 'center' }}>
                                            <img src={imgUrl} alt="Soal" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                        </div>
                                    )}
                                    <div style={{ marginBottom: '0.4rem', lineHeight: 1.3 }}>
                                        <MathText text={q.questionText as string} />
                                    </div>

                                    {qType === 'ISIAN' ? (
                                        <div style={{ marginTop: '1.25rem', borderBottom: '1px dotted #999', width: '100%' }}></div>
                                    ) : qType === 'BENAR_SALAH' ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', marginTop: '0.3rem', fontSize: '0.75rem' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '0.15rem', border: '1px solid #ddd', textAlign: 'left' }}>Pernyataan</th>
                                                    <th style={{ padding: '0.15rem', border: '1px solid #ddd', width: '22px', textAlign: 'center' }}>B</th>
                                                    <th style={{ padding: '0.15rem', border: '1px solid #ddd', width: '22px', textAlign: 'center' }}>S</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                    const optionText = q[`option${opt}`] as string | null;
                                                    if (!optionText) return null;
                                                    return (
                                                        <tr key={opt}>
                                                            <td style={{ padding: '0.15rem', border: '1px solid #ddd' }}><MathText text={optionText} /></td>
                                                            <td style={{ padding: '0.15rem', border: '1px solid #ddd', textAlign: 'center' }}></td>
                                                            <td style={{ padding: '0.15rem', border: '1px solid #ddd', textAlign: 'center' }}></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
                                            {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                const optText = q[`option${opt}`];
                                                if (!optText) return null;
                                                return (
                                                    <div key={opt} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
                                                        {qType === 'PGK' ? (
                                                            <div style={{ minWidth: '12px', height: '12px', border: '1px solid #333', borderRadius: '2px', marginTop: '2px' }}></div>
                                                        ) : (
                                                            <span style={{ minWidth: '12px' }}>{opt}.</span>
                                                        )}
                                                        <span style={{ flex: 1 }}><MathText text={optText as string} /></span>
                                                    </div>
                                                );
                                            })}
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
