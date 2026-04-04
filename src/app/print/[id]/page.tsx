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

    let packageName = 'Paket';
    if (tryoutData.categoryId) {
        const catDoc = await db.collection('packageCategories').doc(tryoutData.categoryId).get();
        if (catDoc.exists) {
            packageName = catDoc.data()!.name;
        }
    }

    // Format: Soal-[Paket]-[Kategori]-[Detail/Title]
    // Example: Soal-Paket 1-SNBT-Penalaran Umum
    const safeFileName = `Soal-${packageName}-${tryoutData.category}-${tryoutData.title}`.replace(/[^a-zA-Z0-9 -]/g, '_');

    const questionsSnap = await db.collection('questions')
        .where('tryoutId', '==', tryoutId)
        .get();

    let questionsData = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Always sort by createdAt for print to ensure consistency with the question package,
    // ignoring the randomization setting used for the online exam.
    questionsData.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateA.getTime() - dateB.getTime();
    });

    const questions = questionsData;

    return (
        <div id="printable-area" style={{ backgroundColor: 'white', color: 'black', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontSize: '11px', width: '100%' }}>
            <PrintClientHelper fileName={safeFileName} />

            {/* Minimalist Modern Header */}
            <div className="print-header" style={{ display: 'flex', alignItems: 'flex-start', paddingBottom: '1rem', borderBottom: '2px solid #F1F5F9', marginBottom: '2rem' }}>
                <div style={{ flex: 1, paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tryoutData.category}</span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Doc. {tryoutId.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#0F172A', lineHeight: 1.2 }}>{tryoutData.title}</h1>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1E293B', marginBottom: tryoutData.description ? '0.4rem' : '0' }}>
                        Paket: {packageName}
                    </div>
                    {tryoutData.description && (
                        <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, marginTop: '0.5rem' }}>
                            {tryoutData.description}
                        </div>
                    )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                    <img src="/vimara-logo.svg" alt="Vimara Logo" style={{ height: '32px', objectFit: 'contain', marginBottom: '0.6rem' }} className="print-logo" />
                    <PrintWatermark userName={session?.name} userEmail={session?.username} />
                </div>
            </div>

            {/* Card Layout for Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {questions.map((q: any, idx) => {
                    const qType = q.questionType as string;
                    const imgUrl = q.imageUrl as string | null;

                    return (
                        <div key={q.id} className="question-card" style={{ 
                            display: 'flex', 
                            border: '1px solid #E2E8F0', 
                            borderRadius: '12px', 
                            overflow: 'hidden',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid'
                        }}>
                            {/* Left Side: Question Content */}
                            <div style={{ flex: '0 0 50%', padding: '1.25rem', borderRight: '1px dashed #CBD5E1' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <div style={{ fontWeight: 'bold', minWidth: '1.4rem', marginTop: '1px' }}>
                                        {String(idx + 1).padStart(2, '0')}.
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        {imgUrl && (
                                            <div style={{ marginBottom: '0.5rem' }}>
                                                <img 
                                                    src={imgUrl} 
                                                    alt="Soal" 
                                                    style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto', maxHeight: '350px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd' }} 
                                                />
                                            </div>
                                        )}
                                        <div style={{ marginBottom: '0.8rem', lineHeight: 1.4 }}>
                                            <MathText text={q.questionText as string} />
                                        </div>

                                        {/* Options */}
                                        {qType === 'ISIAN' ? (
                                            <div style={{ marginTop: '2rem', borderBottom: '1px dotted #999', width: '100%' }}></div>
                                        ) : qType === 'BENAR_SALAH' ? (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#F8FAFC' }}>
                                                        <th style={{ padding: '0.2rem 0.4rem', border: '1px solid #E5E7EB', textAlign: 'left' }}>Pernyataan</th>
                                                        <th style={{ padding: '0.2rem 0.4rem', border: '1px solid #E5E7EB', width: '28px', textAlign: 'center' }}>B</th>
                                                        <th style={{ padding: '0.2rem 0.4rem', border: '1px solid #E5E7EB', width: '28px', textAlign: 'center' }}>S</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                        const optionText = q[`option${opt}`] as string | null;
                                                        if (!optionText) return null;
                                                        return (
                                                            <tr key={opt}>
                                                                <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #E5E7EB' }}><MathText text={optionText} /></td>
                                                                <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #E5E7EB', textAlign: 'center' }}></td>
                                                                <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #E5E7EB', textAlign: 'center' }}></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem' }}>
                                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                    const optText = q[`option${opt}`];
                                                    if (!optText) return null;
                                                    return (
                                                        <div key={opt} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                                                            {qType === 'PGK' ? (
                                                                <div style={{ minWidth: '12px', height: '12px', border: '1px solid #4B5563', borderRadius: '3px', marginTop: '3px' }}></div>
                                                            ) : (
                                                                <span style={{ minWidth: '18px', fontWeight: 600 }}>({opt})</span>
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
                            
                            {/* Right Side: Scratchpad Grid Area (35%) */}
                            <div className="scratchpad-grid" style={{ flex: '1', backgroundColor: '#F8FAFC' }}></div>
                        </div>
                    );
                })}
            </div>
            
            {/* Fixed Print Footer (Repeats on every page) */}
            <div className="print-footer">
                &copy; {new Date().getFullYear()} Vimara | Sarana Latihan Online. All rights reserved.
            </div>
        </div>
    );
}
