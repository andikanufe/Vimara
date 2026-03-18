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

export default function PrintClientHelper({ tryoutId }: { tryoutId?: string }) {
    const [isReady, setIsReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        // Polling to check if all dynamic content is ready
        let retryCount = 0;
        const maxRetries = 30; // 15 seconds total

        const checkReady = setInterval(() => {
            const allImages = Array.from(document.querySelectorAll('img'));
            // exclude the vimara-logo if needed, but complete property works for all
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

    const handlePrint = async () => {
        setIsGenerating(true);
        try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('printable-area');
            
            if (!element) return;

            // Optional: temporarily adjust styles on printable-area if needed 
            // html2pdf does this reasonably well with windowWidth, but we can enforce some defaults
            
            const opt = {
                margin:       [0.5, 0.5, 0.5, 0.5] as [number, number, number, number], // top, left, bottom, right in inches
                filename:     `LBS_${tryoutId || 'Tryout'}_${new Date().getTime()}.pdf`,
                image:        { type: 'jpeg' as const, quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    windowWidth: 1024, // Ensures layout looks like desktop
                    ignoreElements: (el: Element) => el.classList?.contains('no-print')
                },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(element).save();
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Gagal membuat PDF. Silakan coba lagi.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    /* Let html2pdf handle pagination internally */
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

            <div className="no-print floating-controls" data-html2canvas-ignore="true">
                <button
                    onClick={() => window.location.href = '/student/dashboard'}
                    className="btn-back"
                    disabled={isGenerating}
                >
                    ← Kembali
                </button>
                <button
                    onClick={handlePrint}
                    disabled={!isReady || isGenerating}
                    className="btn-print"
                >
                    {!isReady ? '⏳ Memproses grafik...' : isGenerating ? '🔄 Mengunduh PDF...' : '⬇️ Unduh PDF LBS'}
                </button>
            </div>
        </>
    );
}
