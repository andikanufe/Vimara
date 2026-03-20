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

export default function PrintClientHelper({ fileName }: { fileName?: string }) {
    const [isReady, setIsReady] = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        let retryCount = 0;
        const maxRetries = 30; // 15 seconds

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
        setShowModal(true);
        
        // Wait briefly so user reads the instructions, then set title & trigger print
        setTimeout(() => {
            const originalTitle = document.title;
            if (fileName) {
                document.title = fileName;
            }
            
            window.print();
            
            if (fileName) {
                document.title = originalTitle;
            }
            setShowModal(false);
        }, 3000);
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                .no-print { display: none !important; }
                
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 1cm 1.5cm; /* Standard professional paper margins */
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

                    /* 
                       LAYOUT OPTIMIZATION 
                       Prevent large empty gaps by allowing questions to naturally flow
                       but strictly prevent inner contents (images, tables, options) from slicing in half.
                    */
                    .question-block {
                        page-break-inside: auto !important; /* Allow the block to cross pages to avoid white space */
                        margin-bottom: 2rem !important; /* Consistent spacing between questions */
                        border-bottom: 1px solid #ccc !important;
                        padding-bottom: 1.5rem !important;
                    }

                    /* Prevent atomic components from being sliced in half horizontally */
                    p, li, tr, h1, h2, h3, h4, h5, h6,
                    .math-inline, .katex-display, .options-block > div, table {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                        page-break-before: auto !important;
                    }

                    img {
                        max-width: 100%;
                        height: auto;
                        page-break-inside: avoid !important;
                        display: block;
                        margin: 0.5rem 0;
                    }
                    
                    svg, iframe { 
                        max-width: 100%;
                        height: auto;
                        page-break-inside: avoid !important; 
                    }
                    
                    /* Optional utility for the header logo */
                    .print-logo {
                        height: 24px !important;
                        width: auto !important;
                    }
                }
                
                @media screen {
                    .no-print { display: block !important; }
                    .floating-controls {
                        position: fixed; top: 1rem; right: 1rem; display: flex; gap: 0.5rem;
                        z-index: 1000; background: white; padding: 0.75rem; border-radius: 8px;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e5e7eb;
                    }
                    .btn-print {
                        background: #2563EB; color: white; padding: 0.5rem 1rem;
                        border-radius: 6px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s;
                    }
                    .btn-print:disabled { background: #94a3b8; cursor: not-allowed; }
                    .btn-back {
                        background: white; color: #475569; padding: 0.5rem 1rem; border-radius: 6px;
                        font-weight: 600; border: 1px solid #e2e8f0; cursor: pointer; text-decoration: none; font-size: 14px;
                    }
                    .print-modal-overlay {
                        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
                        z-index: 9999; backdrop-filter: blur(4px);
                    }
                    .print-modal {
                        background: white; border-radius: 12px; padding: 2.5rem; max-width: 450px;
                        text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                        animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                }
            `}} />

            {showModal && (
                <div className="no-print print-modal-overlay">
                    <div className="print-modal">
                        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                            🖨️ 📄
                        </div>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', lineHeight: '1.4' }}>
                            Membuka Jendela PDF Asli...
                        </h3>
                        <div style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.6', textAlign: 'left', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <p style={{ margin: '0 0 0.75rem 0', fontWeight: 700, color: '#1e293b' }}>Langkah Menyimpan PDF Profesional:</p>
                            <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                                <li style={{ marginBottom: '0.5rem' }}>Ubah Tujuan (Destination) ke <strong>Simpan sebagai PDF (Save as PDF)</strong>.</li>
                                <li style={{ marginBottom: '0.5rem' }}>Pada mode Ukuran/Kertas, pilih <strong>A4</strong>.</li>
                                <li>Klik tombol <strong>Simpan (Save)</strong>.</li>
                            </ol>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '22px', height: '22px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>Mohon tunggu 3 detik...</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print floating-controls" data-html2canvas-ignore="true">
                <button
                    onClick={() => window.location.href = '/student/dashboard'}
                    className="btn-back"
                    disabled={showModal}
                >
                    ← Kembali
                </button>
                <button
                    onClick={handlePrint}
                    disabled={!isReady || showModal}
                    className="btn-print"
                >
                    {!isReady ? '⏳ Menyusun Data...' : showModal ? '🔄 Membuka Print...' : '🖨️ Simpan PDF Asli'}
                </button>
            </div>
        </>
    );
}
