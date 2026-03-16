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
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>
            Diunduh oleh: <strong>{userName}</strong> ({userEmail}) • {timeStr}
        </div>
    );
}

export default function PrintClientHelper() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Polling to check if all dynamic content is ready
        let retryCount = 0;
        const maxRetries = 30; // 15 seconds total

        const checkReady = setInterval(() => {
            const allImages = Array.from(document.querySelectorAll('img'));
            const imagesReady = allImages.every(img => img.complete);

            const allGraphs = Array.from(document.querySelectorAll('[data-rendering]'));
            const graphsReady = allGraphs.every(el => el.getAttribute('data-rendering') === 'false');

            retryCount++;

            if ((imagesReady && graphsReady) || retryCount >= maxRetries) {
                clearInterval(checkReady);
                setIsReady(true);
            }
        }, 500);

        return () => clearInterval(checkReady);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    @page {
                        size: A4 portrait;
                        margin: 1cm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background-color: white !important;
                    }
                    #printable-area {
                        min-height: auto !important;
                        height: auto !important;
                        padding: 0 !important;
                    }
                    /* Ensure elements don't break awkwardly */
                    table { page-break-inside: avoid; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    .question-block { page-break-inside: auto; margin-bottom: 1.5rem !important; }
                    .options-block { page-break-inside: avoid; }
                    .pembahasan-block { page-break-inside: auto; }
                    img { max-width: 100% !important; page-break-inside: avoid; }
                }
                @media screen {
                    .floating-controls {
                        position: fixed;
                        top: 1rem;
                        right: 1rem;
                        display: flex;
                        gap: 0.5rem;
                        z-index: 1000;
                        background: white;
                        padding: 0.75rem;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        border: 1px solid #e5e7eb;
                    }
                    .btn-print {
                        background: #2563EB;
                        color: white;
                        padding: 0.5rem 1rem;
                        border-radius: 6px;
                        font-weight: 600;
                        border: none;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-print:disabled {
                        background: #94a3b8;
                        cursor: not-allowed;
                    }
                    .btn-back {
                        background: white;
                        color: #475569;
                        padding: 0.5rem 1rem;
                        border-radius: 6px;
                        font-weight: 600;
                        border: 1px solid #e2e8f0;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                    }
                }
            `}} />

            <div className="no-print floating-controls">
                <button
                    onClick={() => window.location.href = '/student/dashboard'}
                    className="btn-back"
                >
                    ← Kembali
                </button>
                <button
                    onClick={handlePrint}
                    disabled={!isReady}
                    className="btn-print"
                >
                    {isReady ? '🖨️ Cetak / Simpan PDF' : '⏳ Memproses...'}
                </button>
            </div>
        </>
    );
}
