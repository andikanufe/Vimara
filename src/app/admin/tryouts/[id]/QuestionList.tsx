'use client';

import { useState } from 'react';
import MathText from '@/components/MathText';
import QuestionForm from './QuestionForm';

type QuestionData = {
    id: string;
    questionType: string;
    questionText: string;
    imageUrl: string | null;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    optionE: string | null;
    correctAnswer: string;
};

export default function QuestionList({
    tryoutId,
    initialQuestions,
}: {
    tryoutId: string;
    initialQuestions: QuestionData[];
}) {
    const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchQuestions = async () => { window.location.reload(); };

    const handleEdit = (q: QuestionData) => {
        setEditingId(q.id);
        setTimeout(() => {
            document.getElementById('question-form-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleCancelEdit = () => { setEditingId(null); };
    const handleSaved = () => { setEditingId(null); fetchQuestions(); };

    const handleDelete = async (questionId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) return;
        setDeletingId(questionId);
        try {
            const res = await fetch('/api/tryout/question', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: questionId }),
            });
            if (res.ok) {
                setQuestions(prev => prev.filter(q => q.id !== questionId));
            } else { alert('Gagal menghapus soal'); }
        } catch { alert('Terjadi kesalahan jaringan'); }
        finally { setDeletingId(null); }
    };

    const editingQuestion = editingId ? questions.find(q => q.id === editingId) || null : null;

    const typeBadge = (type: string) => {
        if (type === 'PGK') return 'badge-warning';
        if (type === 'BENAR_SALAH') return 'badge-info';
        if (type === 'ISIAN') return 'badge-success';
        return 'badge-muted';
    };

    const typeLabel = (type: string) => {
        if (type === 'PGK') return 'PGK';
        if (type === 'BENAR_SALAH') return 'B/S';
        if (type === 'ISIAN') return '✍️ ISIAN';
        return 'PG';
    };

    return (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr' }}>
            <div id="question-form-section" style={{ order: 1 }}>
                <QuestionForm tryoutId={tryoutId} editingQuestion={editingQuestion} onCancel={handleCancelEdit} onSaved={handleSaved} />
            </div>

            <div style={{ order: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Daftar Soal</h2>
                    <span className="text-muted text-sm">Total: {questions.length} soal</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {questions.map((q, idx) => {
                        const isBeingEdited = editingId === q.id;
                        const isBeingDeleted = deletingId === q.id;

                        return (
                            <div key={q.id} className="card" style={{
                                opacity: isBeingDeleted ? 0.5 : 1, transition: 'opacity 0.2s',
                                borderLeft: isBeingEdited ? '3px solid var(--warning)' : undefined,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span className="text-muted font-semibold text-sm">#{idx + 1}</span>
                                        <span className={`badge ${typeBadge(q.questionType)}`}>{typeLabel(q.questionType)}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(q)} disabled={isBeingDeleted}
                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>✏️ Edit</button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(q.id)} disabled={isBeingDeleted}
                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                                            {isBeingDeleted ? '...' : '🗑 Hapus'}
                                        </button>
                                    </div>
                                </div>

                                {/* Image */}
                                {q.imageUrl && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <img src={q.imageUrl} alt="Soal" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                    </div>
                                )}

                                {/* Question Text */}
                                <div style={{ fontWeight: 600, lineHeight: 1.6, marginBottom: '0.75rem' }}>
                                    <span className="text-muted" style={{ marginRight: '0.5rem' }}>{idx + 1}.</span>
                                    <MathText text={q.questionText} />
                                </div>

                                {/* Options or ISIAN Answer */}
                                {q.questionType === 'ISIAN' ? (
                                    <div style={{ paddingLeft: '1.5rem' }}>
                                        <div className="result-option correct">
                                            <span style={{ fontWeight: 700 }}>Jawaban:</span>
                                            <span style={{ flex: 1 }}><MathText text={q.correctAnswer} /></span>
                                            <span className="badge badge-success">✓</span>
                                        </div>
                                    </div>
                                ) : q.questionType === 'BENAR_SALAH' ? (
                                    <div style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                                                    <th style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'left' }}>Pernyataan</th>
                                                    <th style={{ padding: '0.5rem', border: '1px solid var(--border)', width: '60px', textAlign: 'center' }}>Benar</th>
                                                    <th style={{ padding: '0.5rem', border: '1px solid var(--border)', width: '60px', textAlign: 'center' }}>Salah</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[{ opt: 'A', index: 0 }, { opt: 'B', index: 1 }, { opt: 'C', index: 2 }, { opt: 'D', index: 3 }, { opt: 'E', index: 4 }].map(item => {
                                                    const optionVal = q[`option${item.opt}` as keyof QuestionData] as string | null;
                                                    if (!optionVal) return null;
                                                    const ans = q.correctAnswer.split(',')[item.index];
                                                    return (
                                                        <tr key={item.opt}>
                                                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)' }}><MathText text={optionVal} /></td>
                                                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>{ans === 'B' ? '✓' : ''}</td>
                                                            <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>{ans === 'S' ? '✓' : ''}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingLeft: '1.5rem' }}>
                                        {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                            const optionVal = q[`option${opt}` as keyof QuestionData] as string | null;
                                            if (!optionVal) return null;
                                            const correctAnswers = q.correctAnswer.split(',');
                                            const isCorrect = correctAnswers.includes(opt);
                                            return (
                                                <div key={opt} className={`result-option ${isCorrect ? 'correct' : ''}`}>
                                                    <span style={{ fontWeight: 700, width: '20px' }}>{opt}.</span>
                                                    <span style={{ flex: 1 }}><MathText text={optionVal} /></span>
                                                    {isCorrect && <span className="badge badge-success">✓ Benar</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {questions.length === 0 && (
                        <div className="empty-state">Belum ada soal. Silakan tambahkan melalui form di atas.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
