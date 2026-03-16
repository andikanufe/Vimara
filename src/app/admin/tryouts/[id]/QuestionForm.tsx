'use client';

import { useState, useEffect, useRef } from 'react';
import MathText from '@/components/MathText';
import { useUI } from '@/providers/UIProvider';

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
    pembahasan: string | null;
};

export default function QuestionForm({
    tryoutId,
    editingQuestion,
    onCancel,
    onSaved,
}: {
    tryoutId: string;
    editingQuestion?: QuestionData | null;
    onCancel?: () => void;
    onSaved?: () => void;
}) {
    const { alert, toast } = useUI();
    const isEditing = !!editingQuestion;
    const [questionType, setQuestionType] = useState(editingQuestion?.questionType || 'PG');
    const [correctAnswers, setCorrectAnswers] = useState<string[]>(
        ['PGK', 'BENAR_SALAH'].includes(editingQuestion?.questionType || '')
            ? editingQuestion!.correctAnswer.split(',')
            : editingQuestion?.correctAnswer ? [editingQuestion.correctAnswer] : ['A']
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Backward compat: if editingQuestion has imageUrl but questionText doesn't contain [img], prepend it
    const initQText = (() => {
        const qt = editingQuestion?.questionText || '';
        const img = editingQuestion?.imageUrl || '';
        if (img && !qt.includes('[img]')) return `[img]${img}[/img]\n${qt}`;
        return qt;
    })();

    const [questionText, setQuestionText] = useState(initQText);
    const [optionA, setOptionA] = useState(editingQuestion?.optionA || '');
    const [optionB, setOptionB] = useState(editingQuestion?.optionB || '');
    const [optionC, setOptionC] = useState(editingQuestion?.optionC || '');
    const [optionD, setOptionD] = useState(editingQuestion?.optionD || '');
    const [optionE, setOptionE] = useState(editingQuestion?.optionE || '');
    const [isianAnswer, setIsianAnswer] = useState(
        editingQuestion?.questionType === 'ISIAN' ? editingQuestion.correctAnswer : ''
    );
    const [pembahasan, setPembahasan] = useState(editingQuestion?.pembahasan || '');
    const [customAiPrompt, setCustomAiPrompt] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [aiUsage, setAiUsage] = useState({ count: 0, limit: 20 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('ai_usage_groq') || '{}');
            const now = Date.now();
            const twoHours = 2 * 60 * 60 * 1000;
            if (stored.windowStart && (now - stored.windowStart) < twoHours) {
                setAiUsage(prev => ({ ...prev, count: stored.count || 0 }));
            } else {
                localStorage.setItem('ai_usage_groq', JSON.stringify({ windowStart: now, count: 0 }));
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (editingQuestion) {
            setQuestionType(editingQuestion.questionType);
            const qt = editingQuestion.questionText;
            const img = editingQuestion.imageUrl || '';
            setQuestionText(img && !qt.includes('[img]') ? `[img]${img}[/img]\n${qt}` : qt);
            setOptionA(editingQuestion.optionA || '');
            setOptionB(editingQuestion.optionB || '');
            setOptionC(editingQuestion.optionC || '');
            setOptionD(editingQuestion.optionD || '');
            setOptionE(editingQuestion.optionE || '');
            setIsianAnswer(editingQuestion.questionType === 'ISIAN' ? editingQuestion.correctAnswer : '');
            setCorrectAnswers(
                ['PGK', 'BENAR_SALAH'].includes(editingQuestion.questionType)
                    ? editingQuestion.correctAnswer.split(',')
                    : editingQuestion.questionType === 'ISIAN'
                        ? []
                        : [editingQuestion.correctAnswer]
            );
            setPembahasan(editingQuestion.pembahasan || '');
            setShowPreview(false);
        }
    }, [editingQuestion]);

    const handleCheckboxChange = (opt: string) => {
        setCorrectAnswers(prev =>
            prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt].sort()
        );
    };

    const handleGenerateAI = async () => {
        if (!questionText.trim()) {
            alert('Peringatan', 'Isi soal terlebih dahulu sebelum generate pembahasan AI.');
            return;
        }
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/generate-pembahasan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionText: questionText.replace(/\[img\][\s\S]*?\[\/img\]/g, '').trim(),
                    questionType,
                    optionA, optionB, optionC, optionD, optionE,
                    correctAnswer: ['PGK', 'BENAR_SALAH'].includes(questionType)
                        ? correctAnswers.join(',')
                        : questionType === 'ISIAN' ? isianAnswer : correctAnswers[0] || 'A',
                    customPrompt: customAiPrompt.trim()
                }),
            });
            const data = await res.json();
            if (res.ok && data.pembahasan) {
                setPembahasan(data.pembahasan);
                
                // Update local usage counter (2-hour rolling window)
                const now = Date.now();
                const twoHours = 2 * 60 * 60 * 1000;
                const stored = JSON.parse(localStorage.getItem('ai_usage_groq') || '{}');
                const inWindow = stored.windowStart && (now - stored.windowStart) < twoHours;
                const newCount = inWindow ? (stored.count || 0) + 1 : 1;
                setAiUsage(prev => ({ ...prev, count: newCount }));
                localStorage.setItem('ai_usage_groq', JSON.stringify({ windowStart: inWindow ? stored.windowStart : now, count: newCount }));
                
                toast('Pembahasan berhasil di-generate oleh AI! ✨', 'success');
            } else {
                alert('Gagal', data.error || 'AI tidak menghasilkan pembahasan.');
            }
        } catch {
            alert('Error', 'Gagal menghubungi AI. Cek koneksi internet.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Extract first [img] URL for backward compat imageUrl field
        const imgMatch = questionText.match(/\[img\]([\s\S]*?)\[\/img\]/);
        let extractedImageUrl: string | null = null;
        if (imgMatch) {
            let u = imgMatch[1].trim();
            const gd = u.match(/(?:file\/d\/|id=|folders\/)([\w-]{25,})/);
            if (gd && gd[1]) u = `https://drive.google.com/thumbnail?id=${gd[1]}&sz=w1000`;
            extractedImageUrl = u;
        }
        // Store clean questionText (without [img] blocks) for backward compat
        const data: Record<string, unknown> = {
            ...(isEditing ? { id: editingQuestion!.id } : { tryoutId }),
            questionType,
            questionText,
            imageUrl: extractedImageUrl,
            correctAnswer: ['PGK', 'BENAR_SALAH'].includes(questionType)
                ? correctAnswers.join(',')
                : questionType === 'ISIAN'
                    ? isianAnswer
                    : correctAnswers[0] || 'A',
        };

        // Only include options for PG/PGK
        if (questionType !== 'ISIAN') {
            data.optionA = optionA;
            data.optionB = optionB;
            data.optionC = optionC;
            data.optionD = optionD;
            data.optionE = optionE || null;
        }

        data.pembahasan = pembahasan || null;

        try {
            const res = await fetch('/api/tryout/question', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                if (!isEditing) {
                    setQuestionText(''); setOptionA(''); setOptionB('');
                    setOptionC(''); setOptionD(''); setOptionE('');
                    setIsianAnswer(''); setPembahasan('');
                    setQuestionType('PG'); setCorrectAnswers(['A']);
                    setShowPreview(false);
                    toast('Soal berhasil ditambahkan', 'success');
                } else {
                    toast('Perubahan disimpan', 'success');
                }
                if (onSaved) onSaved();
                else window.location.reload();
            } else {
                alert('Gagal', 'Gagal menyimpan soal');
            }
        } catch {
            alert('Error', 'Terjadi kesalahan jaringan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasContent = questionText.length > 0 || optionA.length > 0;
    const hasSpecial = [questionText, optionA, optionB, optionC, optionD, optionE, pembahasan].some(t => t.includes('$') || t.includes('['));

    return (
        <div className="card" style={{ borderLeft: isEditing ? '3px solid var(--warning)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                    {isEditing ? '✏️ Edit Soal' : '➕ Tambah Soal Baru'}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {hasContent && (
                        <button type="button" className={`btn ${showPreview ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setShowPreview(!showPreview)}>
                            {showPreview ? '📝 Kembali Edit' : '👁 Preview'}
                        </button>
                    )}
                    {isEditing && onCancel && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                            ✕ Batal
                        </button>
                    )}
                </div>
            </div>

            {/* Preview Panel */}
            {showPreview && hasContent && (
                <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius)', border: '1px dashed var(--border)' }}>
                    <div className="text-xs font-bold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>📐 Preview Output</div>
                    <div style={{ marginBottom: '1rem', fontWeight: 600, lineHeight: 1.7 }}>
                        <MathText text={questionText} />
                    </div>
                    {questionType === 'ISIAN' ? (
                        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--success-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)' }}>
                            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Jawaban Benar:</span>
                            <span style={{ fontWeight: 700 }}><MathText text={isianAnswer} /></span>
                        </div>
                    ) : questionType === 'BENAR_SALAH' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                                        <th style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'left' }}>Pernyataan</th>
                                        <th style={{ padding: '0.5rem', border: '1px solid var(--border)', width: '80px', textAlign: 'center' }}>Benar</th>
                                        <th style={{ padding: '0.5rem', border: '1px solid var(--border)', width: '80px', textAlign: 'center' }}>Salah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[{ label: 0, text: optionA }, { label: 1, text: optionB }, { label: 2, text: optionC }, { label: 3, text: optionD }, { label: 4, text: optionE }].map(opt => {
                                        if (!opt.text) return null;
                                        const ans = correctAnswers[opt.label];
                                        return (
                                            <tr key={opt.label}>
                                                <td style={{ padding: '0.5rem', border: '1px solid var(--border)' }}><MathText text={opt.text} /></td>
                                                <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>{ans === 'B' ? '✓' : ''}</td>
                                                <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>{ans === 'S' ? '✓' : ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[{ label: 'A', text: optionA }, { label: 'B', text: optionB }, { label: 'C', text: optionC }, { label: 'D', text: optionD }, { label: 'E', text: optionE }].map(opt => {
                                if (!opt.text) return null;
                                const isCorrect = correctAnswers.includes(opt.label);
                                return (
                                    <div key={opt.label} className={`result-option ${isCorrect ? 'correct' : ''}`}>
                                        <span style={{ fontWeight: 700, width: '20px' }}>{opt.label}.</span>
                                        <span style={{ flex: 1 }}><MathText text={opt.text} /></span>
                                        {isCorrect && <span className="badge badge-success">✓</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {!showPreview && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', fontSize: '0.8125rem', backgroundColor: 'hsl(210, 100%, 97%)', borderRadius: 'var(--radius-sm)', color: 'hsl(210, 60%, 40%)', border: '1px solid hsl(210, 80%, 90%)', lineHeight: 1.7 }}>
                        <strong>📌 Panduan Format:</strong>
                        <div style={{ marginTop: '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span>🔢 <strong>LaTeX:</strong> <code>$x^2$</code> inline, <code>$$\frac{'{'} a{'}'}{'{'}b{'}'}$$</code> display</span>
                            <span>📊 <strong>Tabel:</strong> <code>[table]Kol1|Kol2\nData1|Data2[/table]</code></span>
                            <span>🐍 <strong>Python:</strong> <code>[python]import matplotlib...plt.show()[/python]</code></span>
                            <span>📐 <strong>TikZ:</strong> <code>[tikz]\begin{'{'}tikzpicture{'}'}...\end{'{'}tikzpicture{'}'}[/tikz]</code></span>
                            <span>🖼️ <strong>Gambar:</strong> <code>[img]link-google-drive-atau-url[/img]</code></span>
                        </div>
                    </div>
                )}

                {/* Question Type */}
                <div className="form-group">
                    <label className="form-label">Tipe Soal</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { key: 'PG', label: 'PG (Pilihan Ganda)' },
                            { key: 'PGK', label: 'PGK (PG Kompleks)' },
                            { key: 'BENAR_SALAH', label: 'B/S (Benar Salah)' },
                            { key: 'ISIAN', label: '✍️ Isian Singkat' },
                        ].map(t => (
                            <button key={t.key} type="button"
                                className={`btn ${questionType === t.key ? 'btn-primary' : 'btn-outline'} btn-sm`}
                                onClick={() => {
                                    setQuestionType(t.key);
                                    if (t.key === 'PGK') setCorrectAnswers([]);
                                    else if (t.key === 'BENAR_SALAH') setCorrectAnswers(['B', 'B', 'B', 'B', 'B']);
                                    else if (t.key === 'PG') setCorrectAnswers(['A']);
                                    else setCorrectAnswers([]);
                                }}
                            >{t.label}</button>
                        ))}
                    </div>
                    {questionType === 'ISIAN' && (
                        <div className="text-sm text-muted" style={{ marginTop: '0.375rem' }}>
                            Siswa menjawab dengan mengetik teks. Jawaban dicocokkan secara case-insensitive.
                        </div>
                    )}
                </div>

                {/* Question Text */}
                <div className="form-group">
                    <label className="form-label" htmlFor="questionText">Pertanyaan / Isi Soal</label>
                    <textarea id="questionText" name="questionText" className="form-input" rows={4} required
                        value={questionText} onChange={(e) => setQuestionText(e.target.value)}
                        placeholder={`Contoh: Berapakah hasil dari $\\frac{d}{dx}(x^2)$ ?\n\nUntuk gambar: [img]https://drive.google.com/file/d/...[/img]`}
                        style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    {hasSpecial && !showPreview && questionText && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Preview:</span>
                            <MathText text={questionText} />
                        </div>
                    )}
                </div>

                {/* Options (PG / PGK / BENAR_SALAH) */}
                {questionType !== 'ISIAN' && questionType !== 'BENAR_SALAH' && (
                    <>
                        <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                            {[
                                { label: 'Pilihan A', value: optionA, setter: setOptionA, name: 'optionA' },
                                { label: 'Pilihan B', value: optionB, setter: setOptionB, name: 'optionB' },
                                { label: 'Pilihan C', value: optionC, setter: setOptionC, name: 'optionC' },
                                { label: 'Pilihan D', value: optionD, setter: setOptionD, name: 'optionD' },
                            ].map(opt => (
                                <div key={opt.name} className="form-group">
                                    <label className="form-label">{opt.label}</label>
                                    <input name={opt.name} type="text" className="form-input" required
                                        value={opt.value} onChange={(e) => opt.setter(e.target.value)} />
                                    {opt.value.includes('$') && (
                                        <div className="text-xs" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                            → <MathText text={opt.value} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Pilihan E (Opsional)</label>
                                <input name="optionE" type="text" className="form-input" value={optionE} onChange={(e) => setOptionE(e.target.value)} />
                                {optionE.includes('$') && (
                                    <div className="text-xs" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>→ <MathText text={optionE} /></div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    {questionType === 'PGK' ? 'Jawaban Benar (centang semua)' : 'Jawaban Benar'}
                                </label>
                                {questionType === 'PG' ? (
                                    <select name="correctAnswer" className="form-input" required value={correctAnswers[0] || 'A'} onChange={(e) => setCorrectAnswers([e.target.value])}>
                                        {['A', 'B', 'C', 'D', 'E'].map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.375rem' }}>
                                        {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                            <label key={opt} className={`pgk-check-label ${correctAnswers.includes(opt) ? 'checked' : ''}`}>
                                                <input type="checkbox" checked={correctAnswers.includes(opt)} onChange={() => handleCheckboxChange(opt)} style={{ display: 'none' }} />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {questionType === 'PGK' && correctAnswers.length > 0 && (
                                    <div className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>Dipilih: {correctAnswers.join(', ')}</div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {questionType === 'BENAR_SALAH' && (
                    <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                        {[
                            { label: 'Pernyataan 1', value: optionA, setter: setOptionA, name: 'optionA', index: 0 },
                            { label: 'Pernyataan 2', value: optionB, setter: setOptionB, name: 'optionB', index: 1 },
                            { label: 'Pernyataan 3', value: optionC, setter: setOptionC, name: 'optionC', index: 2 },
                            { label: 'Pernyataan 4 (Opsional)', value: optionD, setter: setOptionD, name: 'optionD', index: 3 },
                            { label: 'Pernyataan 5 (Opsional)', value: optionE, setter: setOptionE, name: 'optionE', index: 4 },
                        ].map(opt => (
                            <div key={opt.name} className="form-group">
                                <label className="form-label">{opt.label}</label>
                                <input name={opt.name} type="text" className="form-input" required={opt.index < 3}
                                    value={opt.value} onChange={(e) => opt.setter(e.target.value)} />
                                {opt.value.includes('$') && (
                                    <div className="text-xs" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                        → <MathText text={opt.value} />
                                    </div>
                                )}
                                {opt.value && (
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <input type="radio" checked={correctAnswers[opt.index] === 'B'} onChange={() => {
                                                const newAns = [...correctAnswers];
                                                newAns[opt.index] = 'B';
                                                for (let i = 0; i < 5; i++) if (!newAns[i]) newAns[i] = 'B';
                                                setCorrectAnswers(newAns);
                                            }} /> Benar
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <input type="radio" checked={correctAnswers[opt.index] === 'S'} onChange={() => {
                                                const newAns = [...correctAnswers];
                                                newAns[opt.index] = 'S';
                                                for (let i = 0; i < 5; i++) if (!newAns[i]) newAns[i] = 'B';
                                                setCorrectAnswers(newAns);
                                            }} /> Salah
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ISIAN Answer */}
                {questionType === 'ISIAN' && (
                    <div className="form-group">
                        <label className="form-label">Jawaban Benar (Isian)</label>
                        <input type="text" className="form-input" required value={isianAnswer} onChange={(e) => setIsianAnswer(e.target.value)}
                            placeholder="Jawaban yang benar (case-insensitive)" />
                        {isianAnswer.includes('$') && (
                            <div className="text-xs" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>→ <MathText text={isianAnswer} /></div>
                        )}
                        <div className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>Jawaban siswa akan dicocokkan secara case-insensitive (huruf besar/kecil diabaikan)</div>
                    </div>
                )}

                {/* Pembahasan */}
                <div className="form-group" style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: 'hsl(270, 50%, 98%)', borderRadius: 'var(--radius)', border: '1px solid hsl(270, 40%, 90%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            📖 Pembahasan Soal <span className="text-xs text-muted">(Opsional)</span>
                        </label>
                        <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                            onClick={handleGenerateAI}
                            disabled={isGenerating || !questionText.trim() || aiUsage.count >= aiUsage.limit}
                            title={`${aiUsage.count}/${aiUsage.limit} generate dalam 2 jam terakhir`}
                        >
                            {isGenerating ? '⏳ Generating...' : `✨ Generate AI (${aiUsage.count}/${aiUsage.limit})`}
                        </button>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            Instruksi Khusus untuk AI (Revisi/Prompt Opsional)
                        </label>
                        <textarea
                            className="form-input"
                            rows={2}
                            value={customAiPrompt}
                            onChange={(e) => setCustomAiPrompt(e.target.value)}
                            placeholder="Contoh: 'Buat penjelasan lebih singkat', 'Fokus pada rumus XYZ', 'Jangan pakai garis bilangan Python'..."
                            style={{ fontSize: '0.8125rem', borderColor: 'hsl(270, 40%, 80%)' }}
                        />
                    </div>

                    <textarea
                        className="form-input"
                        rows={4}
                        value={pembahasan}
                        onChange={(e) => setPembahasan(e.target.value)}
                        placeholder="Tuliskan pembahasan soal atau klik 'Generate AI' memuat pembahasan otomatis..."
                        style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    {pembahasan && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(270, 40%, 90%)' }}>
                            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Preview Pembahasan:</span>
                            <div style={{ lineHeight: 1.7 }}><MathText text={pembahasan} /></div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="submit" className={`btn ${isEditing ? 'btn-warning' : 'btn-primary'}`} style={{ flex: 1 }}
                        disabled={isSubmitting || (questionType === 'PGK' && correctAnswers.length < 2)}>
                        {isSubmitting ? 'Menyimpan...' : isEditing ? '💾 Simpan Perubahan' : '➕ Simpan Soal'}
                    </button>
                </div>
                {questionType === 'PGK' && correctAnswers.length < 2 && (
                    <div className="text-xs text-muted" style={{ marginTop: '0.375rem', textAlign: 'center' }}>Pilih minimal 2 jawaban benar untuk soal PGK</div>
                )}
            </form>
        </div>
    );
}
