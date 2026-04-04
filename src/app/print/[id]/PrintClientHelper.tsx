'use client';

import { useEffect, useState } from 'react';

export function PrintWatermark({ userName, userEmail }: { userName?: string, userEmail?: string }) {
    const [timeStr, setTimeStr] = useState('');
    useEffect(() => {
        const now = new Date();
        setTimeStr(`${now.toLocaleDateString('id-ID')} jam ${now.toLocaleTimeString('id-ID')}`);
    }, []);

    if (!userName || !timeStr) return null;
    return (
        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, textAlign: 'right' }}>
            Diunduh oleh: <strong>{userName}</strong><br/>
            <span style={{ fontSize: '0.7rem' }}>{timeStr}</span>
        </div>
    );
}

export default function PrintClientHelper({ fileName }: { fileName?: string }) {
    const [status, setStatus] = useState<'loading' | 'ready'>('loading');
    const [progress, setProgress] = useState<{ total: number, done: number } | null>(null);

    useEffect(() => {
        let cancelled = false;

        const waitForImages = async (images: HTMLImageElement[]) => {
            await Promise.all(images.map((img) => {
                img.loading = 'eager';
                img.decoding = 'async';
                if (img.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    const done = () => {
                        img.removeEventListener('load', done);
                        img.removeEventListener('error', done);
                        resolve();
                    };
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                });
            }));
        };

        const waitForGraphs = async () => {
            while (true) {
                if (cancelled) return;
                const allGraphs = Array.from(document.querySelectorAll('[data-rendering]'));
                const renderingList = allGraphs.filter(el => el.getAttribute('data-rendering') === 'true');
                
                const totalCount = allGraphs.length;
                const activeCount = renderingList.length;
                const doneCount = totalCount - activeCount;

                setProgress({ total: totalCount, done: doneCount });

                if (activeCount === 0) return;
                await new Promise((r) => setTimeout(r, 500));
            }
        };

        const preparePrint = async () => {
            const printableRoot = document.getElementById('printable-area') ?? document.body;
            const images = Array.from(printableRoot.querySelectorAll('img'));
            
            // Wait for images with 30s timeout
            const imageWait = waitForImages(images);
            const imageTimeout = new Promise<void>((resolve) => setTimeout(resolve, 30000));
            await Promise.race([imageWait, imageTimeout]);

            // Wait for Python Graphs INDEFINITELY because Pyodide can take extremely long 
            // for heavily intensive graphic tests, as requested.
            await waitForGraphs();

            if (!cancelled) {
                setStatus('ready');
            }
        };

        preparePrint();
        return () => { cancelled = true; };
    }, []);

    const handlePrint = () => {
        const originalTitle = document.title;
        if (fileName) {
            document.title = fileName;
        }

        window.print();

        if (fileName) {
            document.title = originalTitle;
        }
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                .no-print { display: none !important; }
                
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 1cm 1.5cm 1.5cm 1.5cm; /* Increased bottom margin for footer */
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background-color: white !important;
                        font-family: Arial, sans-serif;
                        color: black !important;
                        line-height: 1.4;
                    }
                    #printable-area {
                        background-color: white !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Fixed Print Footer */
                    .print-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        text-align: center;
                        font-size: 9px;
                        color: #64748b;
                        padding-top: 6px;
                        border-top: 1px dashed #cbd5e1;
                    }

                    /* 
                       LAYOUT OPTIMIZATION 
                    */
                    .question-card {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    
                    /* Grid background pattern for the scratchpad */
                    .scratchpad-grid {
                        background-image: radial-gradient(#CBD5E1 1px, transparent 1px) !important;
                        background-size: 20px 20px !important;
                        background-position: 0 0 !important;
                    }

                    /* Prevent atomic components from being sliced in half horizontally */
                    p, li, tr, h1, h2, h3, h4, h5, h6,
                    .math-inline, .katex-display, .options-block > div, table {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                        page-break-before: auto !important;
                    }

                    img {
                        width: auto !important;
                        height: auto !important;
                        max-width: 100%;
                        display: block;
                        margin: 0.5rem auto; /* Center the image */
                        page-break-inside: avoid !important;
                    }
                    
                    svg, iframe { 
                        max-width: 100%;
                        height: auto;
                        page-break-inside: avoid !important; 
                    }
                    
                    .print-logo {
                        height: 32px !important;
                        width: auto !important;
                    }
                }
                
                @media screen {
                    .no-print { display: block !important; }
                    .print-footer {
                        margin-top: 2rem; border-top: 1px solid #E5E7EB; padding-top: 1rem; text-align: center; font-size: 0.75rem; color: #64748b;
                    }
                    .floating-controls {
                        position: fixed; top: 1.5rem; right: 1.5rem; display: flex; gap: 0.5rem;
                        z-index: 1000; background: white; padding: 0.5rem 0.75rem; border-radius: 8px;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); 
                        border: 1px solid #e2e8f0; align-items: center;
                    }
                    .btn-print {
                        background: #1E293B; color: white; padding: 0.4rem 0.8rem;
                        border-radius: 6px; font-weight: 500; border: none; cursor: pointer; transition: all 0.2s; font-size: 13px;
                    }
                    .btn-print:disabled { background: #94a3b8; cursor: not-allowed; }
                    .btn-print:hover:not(:disabled) { background: #0F172A; }
                    .btn-back {
                        background: white; color: #475569; padding: 0.4rem 0.8rem; border-radius: 6px;
                        font-weight: 600; border: 1px solid #e2e8f0; cursor: pointer; text-decoration: none; font-size: 13px;
                    }
                    .btn-back:hover { background: #F8FAFC; }
                }
            `}} />

            <div className="no-print floating-controls" data-html2canvas-ignore="true">
                <button
                    onClick={() => window.location.href = '/student/dashboard'}
                    className="btn-back"
                >
                    Kembali
                </button>
                <div style={{ width: '1px', height: '20px', background: '#E2E8F0', margin: '0 4px' }}></div>
                <button
                    onClick={handlePrint}
                    disabled={status === 'loading'}
                    className="btn-print"
                >
                    {status === 'loading' 
                        ? (progress && progress.total > 0 
                            ? `⏳ Memuat Grafik (${progress.done}/${progress.total})...` 
                            : '⏳ Menyiapkan Dokumen...') 
                        : '🖨️ Cetak / Simpan PDF'}
                </button>
            </div>
        </>
    );
}