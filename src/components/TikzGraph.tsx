'use client';

import React, { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

export default function TikzGraph({ code }: { code: string }) {
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Since TikZJax runs automatically on DOM load and mutates <script type="text/tikz">,
        // we need to dynamically inject the script tag when the code changes
        // and trigger TikZJax rendering manually if it's already loaded.
        
        const container = containerRef.current;
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';
        setLoading(true);

        const scriptEl = document.createElement('script');
        scriptEl.type = 'text/tikz';
        scriptEl.textContent = code;
        container.appendChild(scriptEl);

        // If tikzjax is already evaluated globally, it might provide a global process function
        // but its standard usage just observes mutations.
        // We set a timeout to stop loading state visually, assuming mutation observer caught it.
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, [code]);

    return (
        <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-rendering={loading ? "true" : "false"}>
            <link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css" />
            <Script src="https://tikzjax.com/v1/tikzjax.js" strategy="lazyOnload" />
            
            {loading && <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>⏳ Loading...</div>}
            
            {/* 
                TikZJax will replace the <script type="text/tikz"> inside this container 
                with an <svg> element.
            */}
            <div 
                ref={containerRef} 
                style={{ 
                    maxWidth: '100%', 
                    overflowX: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: 'white'
                }} 
            />
        </div>
    );
}
