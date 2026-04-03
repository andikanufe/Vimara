'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tryout = { id: string; title: string; category: string };

type ParsedQuestion = {
  questionType: 'PG' | 'PGK' | 'ISIAN' | 'BENAR_SALAH';
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  correctAnswer: string;
  pembahasan: string;
  pythonCode: string | null;
  pythonCode2: string | null;
};

const TYPE_BADGE: Record<string, string> = {
  PG: 'badge-primary',
  PGK: 'badge-warning',
  ISIAN: 'badge-success',
  BENAR_SALAH: 'badge-info',
};
const TYPE_LABEL: Record<string, string> = {
  PG: 'PG',
  PGK: 'PGK',
  ISIAN: '✍️ ISIAN',
  BENAR_SALAH: 'B/S',
};

export default function ImportClient({ tryouts }: { tryouts: Tryout[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templateText, setTemplateText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [packageName, setPackageName] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  const [selectedTryoutId, setSelectedTryoutId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleParse = async () => {
    if (!templateText.trim()) { setParseError('Template tidak boleh kosong.'); return; }
    setIsParsing(true);
    setParseError('');
    try {
      const res = await fetch('/api/admin/parse-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateText }),
      });
      const data = await res.json();
      if (!res.ok) { setParseError(data.error || 'Gagal parsing'); return; }
      setPackageName(data.packageName || '');
      setQuestions(data.questions || []);
      setParseWarnings(data.errors || []);
      if ((data.questions || []).length === 0) { setParseError('Tidak ada soal yang berhasil di-parse. Cek format template.'); return; }
      setStep(2);
    } catch (e) {
      setParseError('Terjadi kesalahan jaringan.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTryoutId) return;
    setIsImporting(true);
    setImportProgress(0);

    // Simulate progress
    const prog = setInterval(() => setImportProgress(p => Math.min(p + 10, 85)), 200);

    try {
      const res = await fetch('/api/admin/import-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tryoutId: selectedTryoutId, questions }),
      });
      const data = await res.json();
      clearInterval(prog);
      setImportProgress(100);
      setImportResult({ imported: data.importedCount || 0, errors: data.errors || [] });
      setStep(3);
    } catch (e) {
      clearInterval(prog);
      setImportResult({ imported: 0, errors: ['Terjadi kesalahan jaringan.'] });
      setStep(3);
    } finally {
      setIsImporting(false);
    }
  };

  const selectedTryout = tryouts.find(t => t.id === selectedTryoutId);

  return (
    <div className="animate-in">
      <div className="page-header">
        <Link href="/admin/tryouts" className="back-link">← Kembali ke Daftar Tryout</Link>
        <h1>📥 Import Soal dari Template</h1>
        <p className="text-muted text-sm">Paste template soal dari Gemini, preview hasilnya, lalu import ke tryout pilihan Anda.</p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { n: 1, label: 'Paste Template' },
          { n: 2, label: 'Preview & Pilih Tryout' },
          { n: 3, label: 'Hasil Import' },
        ].map(({ n, label }, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {i > 0 && <span style={{ color: 'var(--text-muted)' }}>›</span>}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              color: step === n ? 'var(--primary)' : step > n ? 'var(--success)' : 'var(--text-muted)',
              fontWeight: step === n ? 700 : 400,
              fontSize: '0.875rem',
            }}>
              <span style={{
                width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
                background: step === n ? 'var(--primary)' : step > n ? 'var(--success)' : 'var(--bg-color)',
                color: step >= n ? '#fff' : 'var(--text-muted)',
                border: `2px solid ${step === n ? 'var(--primary)' : step > n ? 'var(--success)' : 'var(--border)'}`,
              }}>{step > n ? '✓' : n}</span>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── STEP 1: PASTE TEMPLATE ── */}
      {step === 1 && (
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>1. Paste Template Soal</h2>
          <div style={{ backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--primary-dark)', lineHeight: 1.6 }}>
            💡 <strong>Tips:</strong> Gunakan Prompt Generator Soal untuk Gemini, lalu paste hasilnya di bawah ini. Format yang diterima: <code>PAKET:</code> di baris pertama, pisah soal dengan <code>---SOAL---</code> atau heading <code>🚀 SOAL N</code>.
          </div>
          <textarea
            style={{ width: '100%', minHeight: '420px', fontFamily: 'monospace', fontSize: '0.8125rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', resize: 'vertical', lineHeight: 1.5, backgroundColor: '#fafafa' }}
            placeholder={`PAKET: LATIHAN SOAL SAS MATEMATIKA KELAS XI - LINGKARAN\n\n---SOAL---\n\n🚀 SOAL 1\n\nSoal:\nSebuah satelit...\na. 26.400 km\nb. 52.800 km\n...\n\nKunci Jawaban: b. 52.800 km\n\nPembahasan:\n...\n\n---SOAL---`}
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
          />
          {parseError && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginTop: '0.5rem' }}>⚠️ {parseError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleParse} disabled={isParsing}>
              {isParsing ? '⏳ Memproses...' : '🔍 Parse & Preview Soal →'}
            </button>
            <button className="btn btn-outline" onClick={() => setTemplateText('')} disabled={isParsing || !templateText}>
              🗑 Bersihkan
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: PREVIEW + PILIH TRYOUT ── */}
      {step === 2 && (
        <div>
          {/* Header info */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="text-muted text-xs font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Nama Paket Terdeteksi</div>
                <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--primary-dark)' }}>{packageName}</div>
                <div className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>{questions.length} soal berhasil di-parse</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => { setStep(1); setParseError(''); }}>← Edit Template</button>
            </div>

            {parseWarnings.length > 0 && (
              <div style={{ marginTop: '0.75rem', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                ⚠️ <strong>{parseWarnings.length} peringatan:</strong> {parseWarnings.join('; ')}
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem' }}>
              Preview Soal yang akan Diimport
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '48px' }}>No</th>
                    <th style={{ width: '90px' }}>Tipe</th>
                    <th>Pertanyaan</th>
                    <th style={{ width: '80px' }}>Kunci</th>
                    <th style={{ width: '80px' }}>Gambar</th>
                    <th style={{ width: '100px' }}>Pembahasan</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td><span className={`badge ${TYPE_BADGE[q.questionType] || 'badge-muted'}`}>{TYPE_LABEL[q.questionType] || q.questionType}</span></td>
                      <td style={{ fontSize: '0.8125rem', maxWidth: '360px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.questionText.slice(0, 100)}{q.questionText.length > 100 ? '...' : ''}
                        </div>
                      </td>
                      <td><code style={{ fontSize: '0.75rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px' }}>{q.correctAnswer}</code></td>
                      <td style={{ textAlign: 'center' }}>{q.pythonCode ? <span title="Ada kode grafik" style={{ color: 'var(--primary)' }}>🐍 Ada</span> : <span className="text-muted text-xs">—</span>}</td>
                      <td style={{ textAlign: 'center' }}>{q.pembahasan ? <span style={{ color: 'var(--success)' }}>✓</span> : <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Select tryout + import */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>2. Pilih Tryout Tujuan</h2>
            <select
              className="form-input"
              style={{ maxWidth: '480px' }}
              value={selectedTryoutId}
              onChange={e => setSelectedTryoutId(e.target.value)}
            >
              <option value="">— Pilih tryout —</option>
              {tryouts.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
              ))}
            </select>

            {selectedTryout && (
              <div style={{ margin: '0.75rem 0', padding: '0.625rem 0.875rem', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--primary-dark)' }}>
                ✅ <strong>{questions.length} soal</strong> akan ditambahkan ke tryout: <strong>{selectedTryout.title}</strong>
              </div>
            )}

            {isImporting && (
              <div style={{ margin: '1rem 0' }}>
                <div className="text-muted text-sm" style={{ marginBottom: '0.375rem' }}>Mengimport soal... {importProgress}%</div>
                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${importProgress}%`, background: 'var(--primary)', borderRadius: '999px', transition: 'width 0.2s ease' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!selectedTryoutId || isImporting}
              >
                {isImporting ? `⏳ Mengimport (${importProgress}%)...` : `🚀 Import ${questions.length} Soal Sekarang`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: RESULT ── */}
      {step === 3 && importResult && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            {importResult.errors.length === 0 ? '🎉' : '⚠️'}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {importResult.errors.length === 0 ? 'Import Berhasil!' : 'Import Selesai dengan Peringatan'}
          </h2>
          <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>
            <strong>{importResult.imported} soal</strong> berhasil diimport ke tryout <strong>{selectedTryout?.title}</strong>.
          </p>

          {importResult.errors.length > 0 && (
            <div style={{ textAlign: 'left', maxWidth: '480px', margin: '0 auto 1.5rem', padding: '0.75rem 1rem', background: 'rgba(220,38,38,0.08)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
              <strong>Error ({importResult.errors.length}):</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={`/admin/tryouts/${selectedTryoutId}`} className="btn btn-primary">
              📝 Lihat Soal di Tryout
            </Link>
            <button className="btn btn-outline" onClick={() => { setStep(1); setTemplateText(''); setQuestions([]); setSelectedTryoutId(''); setImportResult(null); setImportProgress(0); }}>
              📥 Import Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
