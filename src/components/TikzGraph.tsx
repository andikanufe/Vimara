'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function TikzGraph({ code }: { code: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

    useEffect(() => {
        if (!code || !containerRef.current) return;

        let isMounted = true;
        setStatus('loading');

        const container = containerRef.current;
        container.innerHTML = '';

        // Ensure the code has proper tikzpicture wrapper
        const wrappedCode = code.trim().startsWith('\\begin')
            ? code.trim()
            : `\\begin{tikzpicture}\n${code.trim()}\n\\end{tikzpicture}`;

        // Build a self-contained HTML document that loads TikZJax and renders the code
        const iframeDocPattern = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">
  <script>
    // Overwrite alert so it doesn't block
    window.alert = function() {};
    window.console.warn = function() {};
    window.console.error = function() {};
  </script>
  <script src="https://tikzjax.com/v1/tikzjax.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 12px;
      background: white;
      min-height: 50px;
    }
    svg { max-width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <script type="text/tikz">
${wrappedCode}
  </script>
  <script>
    // Fallback: Notify parent when TikZJax is done (it replaces the script with an SVG)
    let checkCount = 0;
    const observer = setInterval(() => {
      const svg = document.querySelector('svg');
      if (svg) {
        clearInterval(observer);
        // Send height + a little padding
        window.parent.postMessage({ type: 'TIKZ_DONE', height: document.body.scrollHeight + 24 }, '*');
      }
      checkCount++;
      if (checkCount > 40) { // 20s timeout
        clearInterval(observer);
        window.parent.postMessage({ type: 'TIKZ_ERROR' }, '*');
      }
    }, 500);
  </script>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.border = '1px solid #e2e8f0';
        iframe.style.borderRadius = '8px';
        iframe.style.background = 'white';
        // Hide initially until loaded to prevent white flash
        iframe.style.visibility = 'hidden'; 
        iframe.style.height = '150px'; // Initial height
        
        // Use srcdoc if supported, otherwise fallback to blob URL
        if ('srcdoc' in document.createElement('iframe')) {
            iframe.srcdoc = iframeDocPattern;
        } else {
             const blob = new Blob([iframeDocPattern], { type: 'text/html' });
             iframe.src = URL.createObjectURL(blob);
        }

        container.appendChild(iframe);

        const handleMessage = (event: MessageEvent) => {
            if (!isMounted) return;
            // Note: In real app, check origin or specific ID if handling multiple
            if (event.data?.type === 'TIKZ_DONE') {
                setStatus('done');
                iframe.style.visibility = 'visible';
                iframe.style.height = `${Math.max(event.data.height, 100)}px`;
                clearTimeout(timeoutId);
            } else if (event.data?.type === 'TIKZ_ERROR') {
                 setStatus('error');
                 clearTimeout(timeoutId);
            }
        };

        window.addEventListener('message', handleMessage);

        // Fallback timeout in parent
        const timeoutId = setTimeout(() => {
            if (!isMounted) return;
            // Only set error if still loading
            setStatus((prev) => prev === 'loading' ? 'error' : prev);
        }, 22000);

        return () => {
            isMounted = false;
            window.removeEventListener('message', handleMessage);
            clearTimeout(timeoutId);
            // Cleanup blob URL if we used it
            if (iframe.src.startsWith('blob:')) {
                URL.revokeObjectURL(iframe.src);
            }
        };
    }, [code]);

    return (
        <div
            style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
            data-rendering={status === 'loading' ? 'true' : 'false'}
        >
            {status === 'loading' && (
                <div style={{
                    padding: '2rem', textAlign: 'center', background: '#f8fafc',
                    borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b',
                    width: '100%'
                }}>
                    ⏳ Loading...
                </div>
            )}

            {status === 'error' && (
                <div style={{
                    padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5',
                    borderRadius: '8px', color: '#dc2626', fontSize: '14px',
                    width: '100%'
                }}>
                    ⚠️ TikZ gagal dirender. Periksa kembali kode TikZ Anda.
                </div>
            )}

            <div 
                ref={containerRef} 
                style={{ 
                    width: '100%',
                    display: status === 'error' ? 'none' : 'block' // Keep block while loading so it exists but visibility=hidden 
                }} 
            />
        </div>
    );
}
