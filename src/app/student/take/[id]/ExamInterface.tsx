'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MathText from '@/components/MathText';
import { useUI } from '@/providers/UIProvider';

type Question = {
  id: string;
  questionType: 'PG' | 'PGK' | 'ISIAN' | 'BENAR_SALAH';
  questionText: string;
  imageUrl: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
};

export default function ExamInterface({
  assignmentId,
  tryoutTitle,
  questions,
  initialAnswers,
  duration,
  startTime,
}: {
  assignmentId: string;
  tryoutTitle: string;
  questions: Question[];
  initialAnswers: Record<string, string>;
  duration: number | null;
  startTime: string | null;
}) {
  const router = useRouter();
  const { alert, confirm, toast } = useUI();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [doubted, setDoubted] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showAnswerGrid, setShowAnswerGrid] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const hasAutoSubmitted = useRef(false);

  const currentQ = questions[currentIndex];

  // Navigation pagination
  const NAV_PAGE_SIZE = 10;
  const [navPage, setNavPage] = useState(0);
  const totalNavPages = Math.ceil(questions.length / NAV_PAGE_SIZE);
  const navStart = navPage * NAV_PAGE_SIZE;
  const navEnd = Math.min(navStart + NAV_PAGE_SIZE, questions.length);

  // Keep navPage synced with currentIndex
  useEffect(() => {
    const page = Math.floor(currentIndex / NAV_PAGE_SIZE);
    setNavPage(page);
  }, [currentIndex]);

  // Build options list for PG/PGK
  const options: string[] = [];
  if (currentQ && currentQ.questionType !== 'ISIAN') {
    if (currentQ.optionA) options.push('A');
    if (currentQ.optionB) options.push('B');
    if (currentQ.optionC) options.push('C');
    if (currentQ.optionD) options.push('D');
    if (currentQ.optionE) options.push('E');
  }

  // --- Anti Cheating Listeners ---
  useEffect(() => {
    const handleViolation = async (reason: string) => {
      setShowWarning(true);
      setViolationCount(prev => prev + 1);
      try {
        await fetch('/api/tryout/violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, reason })
        });
      } catch (e) {
        console.error('Failed to report violation', e);
      }
    };

    // 1. Detect tab switching / minimizing
    const handleVisibilityChange = () => {
      if (document.hidden && isFullscreen) {
        handleViolation('Tab Switch / Minimize');
      }
    };

    // 2. Fullscreen monitor
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        handleViolation('Keluar Fullscreen');
        setIsFullscreen(false);
      }
    };

    // 3. Prevent Right Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 4. Prevent Copy, Cut, Paste
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // 5. Prevent specific keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [assignmentId, isFullscreen]);

  // Timer logic
  useEffect(() => {
    if (!duration || !startTime) return;
    const endTimeMs = new Date(startTime).getTime() + duration * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTimeMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      return remaining;
    };
    tick();
    const interval = setInterval(() => {
      const remaining = tick();
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [duration, startTime]);

  const handleFinish = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tryout/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId })
      });
      const data = await res.json();
      if (res.ok) { router.push(data.redirect); }
      else { alert('Gagal', data.error || 'Terjadi kesalahan'); setIsSubmitting(false); }
    } catch { alert('Error', 'Terjadi kesalahan jaringan'); setIsSubmitting(false); }
  }, [assignmentId, isSubmitting, router, alert]);

  useEffect(() => {
    if (timeLeft === 0 && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      handleFinish();
    }
  }, [timeLeft, handleFinish]);

  const saveAnswer = async (questionId: string, selectedOption?: string, answerText?: string) => {
    setIsSaving(true);
    await fetch('/api/tryout/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, questionId, selectedOption: selectedOption || null, answerText: answerText || null })
    });
    setIsSaving(false);
  };

  const handleSelectOption = async (option: string) => {
    const newAnswers = { ...answers, [currentQ.id]: option };
    setAnswers(newAnswers);
    await saveAnswer(currentQ.id, option);
  };

  const handleToggleOption = async (option: string) => {
    const current = answers[currentQ.id] ? answers[currentQ.id].split(',') : [];
    let updated: string[];
    if (current.includes(option)) { updated = current.filter(o => o !== option); }
    else { updated = [...current, option].sort(); }
    const value = updated.join(',');
    const newAnswers = { ...answers, [currentQ.id]: value };
    setAnswers(newAnswers);
    await saveAnswer(currentQ.id, value);
  };

  const handleBenarSalah = async (index: number, val: 'B' | 'S') => {
    const currentAns = answers[currentQ.id] ? answers[currentQ.id].split(',') : ['', '', '', '', ''];
    while (currentAns.length < 5) currentAns.push('');
    currentAns[index] = val;
    const value = currentAns.join(',');
    setAnswers({ ...answers, [currentQ.id]: value });
    await saveAnswer(currentQ.id, value);
  };

  const isianDebounce = useRef<NodeJS.Timeout | null>(null);
  const handleIsianChange = (text: string) => {
    const newAnswers = { ...answers, [currentQ.id]: text };
    setAnswers(newAnswers);
    if (isianDebounce.current) clearTimeout(isianDebounce.current);
    isianDebounce.current = setTimeout(() => {
      saveAnswer(currentQ.id, undefined, text);
    }, 500);
  };

  const confirmFinish = async () => {
    const ok = await confirm('Selesai Ujian?', 'Apakah Anda yakin ingin mengumpulkan ujian ini? Hasil akan langsung dikalkulasi.');
    if (ok) handleFinish();
  };

  const toggleDoubt = () => {
    setDoubted(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
  };

  const jumpTo = (index: number) => { setCurrentIndex(index); setShowAnswerGrid(false); };
  const goNext = () => { if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1); };
  const goPrev = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };

  const exitExam = async () => {
    const ok = await confirm('Keluar Ujian?', 'Ujian Anda akan tersimpan secara otomatis, dan waktu ujian akan terus berjalan di latar belakang. Anda bisa kembali ke ujian ini dari dashboard. Keluar sekarang?');
    if (ok) {
      router.push('/student/dashboard');
    }
  };

  const formatTimePart = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return { h: h.toString().padStart(2, '0'), m: m.toString().padStart(2, '0'), s: s.toString().padStart(2, '0') };
  };

  if (questions.length === 0) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Belum ada soal pada tryout ini.</h2>
        <button className="btn btn-outline" onClick={() => router.push('/student/dashboard')}>Kembali</button>
      </div>
    );
  }

  const isPGK = currentQ.questionType === 'PGK';
  const isIsian = currentQ.questionType === 'ISIAN';
  const isBenarSalah = currentQ.questionType === 'BENAR_SALAH';
  const selectedPGK = answers[currentQ.id] ? answers[currentQ.id].split(',') : [];
  const selectedBS = isBenarSalah && answers[currentQ.id] ? answers[currentQ.id].split(',') : ['', '', '', '', ''];

  const optionColors: Record<string, string> = {
    A: '#2563eb', B: '#2563eb', C: '#2563eb', D: '#2563eb', E: '#2563eb'
  };

  const allAnswered = questions.length > 0 && questions.every(q => !!answers[q.id] && answers[q.id].replace(/,/g, '').trim().length > 0);

  const timerDanger = timeLeft !== null && timeLeft <= 300;
  const timerWarning = timeLeft !== null && timeLeft <= 600 && !timerDanger;
  const time = timeLeft !== null ? formatTimePart(timeLeft) : null;

  const currentQAnswered = !!answers[currentQ?.id] && String(answers[currentQ?.id]).trim() !== '';

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowWarning(false);
    } catch (err) {
      alert('Gagal', 'Perangkat/Browser Anda tidak mendukung fullscreen otomatis atau diblokir.');
      setIsFullscreen(true); // fallback so they can still take the exam
      setShowWarning(false);
    }
  };

  if (!isFullscreen) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: 'var(--bg-color, #f3f4f6)', padding: '2rem', textAlign: 'center'
      }}>
        <div className="card" style={{ maxWidth: '500px', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🖥️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Mode Layar Penuh Diwajibkan</h1>
          <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Untuk mencegah kecurangan, ujian ini harus dikerjakan dalam mode layar penuh (Fullscreen). Segala aktivitas keluar dari layar penuh atau berpindah aplikasi akan dicatat sebagai pelanggaran.
          </p>
          <button onClick={requestFullscreen} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
            Masuk Layar Penuh & Mulai Ujian
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="v2-exam-layout">
      {/* Anti-Cheating Warning Overlay */}
      {showWarning && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(220, 38, 38, 0.95)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem' }}>⚠️ PERINGATAN!</h1>
          <p style={{ fontSize: '1.25rem', maxWidth: '600px', marginBottom: '1rem' }}>
            Sistem mendeteksi aktivitas mencurigakan (pindah tab atau keluar dari mode layar penuh).
            <br /><br />
            Tindakan ini tercatat di sistem sebagai indikasi kecurangan (Total peringatan: {violationCount}).
          </p>
          <button
            onClick={requestFullscreen}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              backgroundColor: 'white',
              color: 'var(--danger)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Saya Mengerti & Kembali ke Layar Penuh
          </button>
        </div>
      )}

      {/* ===== TOP HEADER BAR ===== */}
      <header className="v2-exam-topbar">
        <button className="v2-back-btn" onClick={exitExam} title="Keluar ke Dashboard">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="v2-topbar-title">{tryoutTitle}</span>
        <div className="v2-topbar-right">
          {time && (
            <div className={`v2-timer ${timerDanger ? 'danger' : timerWarning ? 'warning' : ''}`}>
              <span className="v2-timer-box">{time.h}</span>
              <span className="v2-timer-sep">:</span>
              <span className="v2-timer-box">{time.m}</span>
              <span className="v2-timer-sep">:</span>
              <span className="v2-timer-box">{time.s}</span>
            </div>
          )}
          <button className="v2-submit-btn" onClick={confirmFinish} disabled={isSubmitting || (!allAnswered && timeLeft !== 0)}>
            {isSubmitting ? '...' : 'Kumpulkan'}
          </button>
        </div>
      </header>

      {/* ===== QUESTION NAVIGATION STRIP ===== */}
      <div className="v2-nav-strip">
        <span className="v2-nav-label">Soal {currentIndex + 1}/{questions.length}</span>
        <div className="v2-nav-numbers">
          {navPage > 0 && (
            <button className="v2-nav-arrow" onClick={() => setNavPage(p => p - 1)}>‹</button>
          )}
          {Array.from({ length: navEnd - navStart }, (_, i) => {
            const idx = navStart + i;
            const isAnswered = !!answers[questions[idx].id] && answers[questions[idx].id].length > 0;
            const isCurrent = idx === currentIndex;
            const isDoubted = doubted[questions[idx].id];
            return (
              <button
                key={idx}
                className={`v2-nav-num ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''} ${isDoubted ? 'doubted' : ''}`}
                onClick={() => jumpTo(idx)}
              >
                {idx + 1}
              </button>
            );
          })}
          {navPage < totalNavPages - 1 && (
            <button className="v2-nav-arrow" onClick={() => setNavPage(p => p + 1)}>›</button>
          )}
        </div>
        <button
          className={`v2-grid-toggle ${showAnswerGrid ? 'active' : ''}`}
          onClick={() => setShowAnswerGrid(!showAnswerGrid)}
          title="Jawaban"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="4" height="4" rx="1" /><rect x="6" y="0" width="4" height="4" rx="1" /><rect x="12" y="0" width="4" height="4" rx="1" /><rect x="0" y="6" width="4" height="4" rx="1" /><rect x="6" y="6" width="4" height="4" rx="1" /><rect x="12" y="6" width="4" height="4" rx="1" /><rect x="0" y="12" width="4" height="4" rx="1" /><rect x="6" y="12" width="4" height="4" rx="1" /><rect x="12" y="12" width="4" height="4" rx="1" /></svg>
          <span>Jawaban</span>
        </button>
      </div>

      {/* ===== ANSWER GRID PANEL (toggled) ===== */}
      {showAnswerGrid && (
        <div className="v2-answer-grid-panel">
          <div className="v2-answer-grid">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id] && answers[q.id].length > 0;
              const isCurrent = idx === currentIndex;
              const isDoubted = doubted[q.id];
              return (
                <button
                  key={q.id}
                  className={`v2-grid-btn ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''} ${isDoubted ? 'doubted' : ''}`}
                  onClick={() => jumpTo(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="v2-grid-legend">
            <div className="v2-legend-item">
              <div className="v2-legend-dot answered"></div><span>Dijawab</span>
            </div>
            <div className="v2-legend-item">
              <div className="v2-legend-dot"></div><span>Belum</span>
            </div>
            <div className="v2-legend-item">
              <div className="v2-legend-dot doubted"></div><span>Ragu-ragu</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="v2-exam-content">
        {isPGK && (
          <div className="v2-type-badge warning">PGK — Pilih Beberapa</div>
        )}
        {isIsian && (
          <div className="v2-type-badge success">✍️ ISIAN — Ketik Jawaban</div>
        )}
        {isBenarSalah && (
          <div className="v2-type-badge info" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', marginBottom: '1rem', border: '1px solid' }}>B/S — Tentukan tiap pernyataan Benar atau Salah</div>
        )}

        <div className="v2-content-split">
          {/* LEFT: Question */}
          <div className="v2-question-panel">
            <div className="v2-question-card">
              {currentQ.imageUrl && (
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <img src={currentQ.imageUrl} alt="Soal" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                </div>
              )}
              <div className="v2-question-text">
                <MathText text={currentQ.questionText} />
              </div>
            </div>
          </div>

          {/* RIGHT: Options */}
          <div className="v2-options-panel">
            {isIsian ? (
              <div className="v2-isian-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input v2-isian-input"
                  placeholder="Ketik jawaban Anda di sini..."
                  value={answers[currentQ.id] || ''}
                  onKeyDown={(e) => {
                    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '-', 'Minus'].includes(e.key)) return;
                    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => handleIsianChange(e.target.value)}
                  autoFocus
                />
                <div className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                  💡 Jawaban berupa bilangan bulat (tanpa titik/koma), misal: 1000. Jawaban tidak case-sensitive.
                </div>
              </div>
            ) : isBenarSalah ? (
              <div className="v2-benar-salah-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 600 }}>Pernyataan</th>
                      <th style={{ padding: '0.75rem', border: '1px solid #e5e7eb', width: '80px', textAlign: 'center', fontWeight: 600 }}>Benar</th>
                      <th style={{ padding: '0.75rem', border: '1px solid #e5e7eb', width: '80px', textAlign: 'center', fontWeight: 600 }}>Salah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[{ opt: 'A', index: 0 }, { opt: 'B', index: 1 }, { opt: 'C', index: 2 }, { opt: 'D', index: 3 }, { opt: 'E', index: 4 }].map(item => {
                      const optionKey = `option${item.opt}` as keyof Question;
                      const optionText = currentQ[optionKey] as string;
                      if (!optionText) return null;
                      const ans = selectedBS[item.index];
                      return (
                        <tr key={item.opt}>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb' }}><MathText text={optionText} /></td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <input type="radio" name={`bs-${currentQ.id}-${item.index}`} checked={ans === 'B'} onChange={() => handleBenarSalah(item.index, 'B')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                            <input type="radio" name={`bs-${currentQ.id}-${item.index}`} checked={ans === 'S'} onChange={() => handleBenarSalah(item.index, 'S')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="v2-options-list">
                {options.map(opt => {
                  const optionKey = `option${opt}` as keyof Question;
                  const optionText = currentQ[optionKey] as string;

                  if (isPGK) {
                    const isChecked = selectedPGK.includes(opt);
                    return (
                      <button key={opt} onClick={() => handleToggleOption(opt)}
                        className={`v2-option ${isChecked ? 'selected' : ''}`} style={{ textAlign: 'left', alignItems: 'flex-start' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '4px', border: '2px solid',
                          marginRight: '0.75rem', flexShrink: 0,
                          background: isChecked ? '#2563eb' : '#fff',
                          borderColor: isChecked ? '#2563eb' : '#d1d5db',
                          color: '#fff'
                        }}>
                          {isChecked && <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                        </span>
                        <span className="v2-option-text" style={{ flex: 1, paddingTop: '2px' }}><MathText text={optionText} /></span>
                      </button>
                    );
                  } else {
                    const isSelected = answers[currentQ.id] === opt;
                    return (
                      <button key={opt} onClick={() => handleSelectOption(opt)}
                        className={`v2-option ${isSelected ? 'selected' : ''}`}>
                        <span className="v2-option-circle" style={{ background: isSelected ? optionColors[opt] : '#f3f4f6', color: isSelected ? '#fff' : '#6b7280', borderColor: isSelected ? optionColors[opt] : '#e5e7eb' }}>
                          {opt}
                        </span>
                        <span className="v2-option-text"><MathText text={optionText} /></span>
                      </button>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>

        {/* QN-ID label */}
        <div className="v2-qn-id">QN-ID: {currentQ.id.slice(0, 10)}</div>
      </div>

      {/* ===== BOTTOM BAR ===== */}
      <footer className="v2-exam-bottombar">
        <button className="v2-bottom-btn outline" onClick={goPrev} disabled={currentIndex === 0} title="Soal Sebelumnya" style={{ padding: '0.5rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <button className={`v2-bottom-btn doubt ${doubted[currentQ.id] ? 'active' : ''}`} onClick={toggleDoubt}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />{doubted[currentQ.id] && <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}</svg>
          Ragu-ragu
        </button>

        <div className="v2-bottom-right">
          <span className="v2-save-status">
            {isSaving ? '💾 Menyimpan...' : (currentQAnswered ? '✓ Tersimpan' : '')}
          </span>
          <button className="v2-bottom-btn primary" onClick={goNext} disabled={currentIndex === questions.length - 1} title="Soal Selanjutnya" style={{ padding: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
