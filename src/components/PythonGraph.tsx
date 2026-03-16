'use client';

import React, { useEffect, useState } from 'react';
import Script from 'next/script';

declare global {
    interface Window {
        loadPyodide: (config: { indexURL: string }) => Promise<any>;
        pyodide: any;
    }
}

export default function PythonGraph({ code }: { code: string }) {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPyodideReady, setIsPyodideReady] = useState(false);

    useEffect(() => {
        if (typeof window.loadPyodide === 'function') {
            setIsPyodideReady(true);
        } else {
            const interval = setInterval(() => {
                if (typeof window.loadPyodide === 'function') {
                    setIsPyodideReady(true);
                    clearInterval(interval);
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, []);

    useEffect(() => {
        if (!isPyodideReady || !code) return;

        let isMounted = true;

        async function runPython() {
            if (!isMounted) return;
            setLoading(true);
            setError(null);
            setImgSrc(null);

            try {
                if (!window.pyodide) {
                    window.pyodide = await window.loadPyodide({
                        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                    });
                }
                const pyodide = window.pyodide;

                // Load matplotlib and micropip
                await pyodide.loadPackage(['matplotlib', 'micropip']);
                const micropip = pyodide.pyimport('micropip');

                // Extract package names from user code to install via micropip
                const imports = new Set<string>();
                const regex = /^(?:from\s+([a-zA-Z0-9_]+)|\s*import\s+([a-zA-Z0-9_]+)(?:\s+as\s+[a-zA-Z0-9_]+)?)/gm;
                let match;
                while ((match = regex.exec(code)) !== null) {
                    if (match[1]) imports.add(match[1]);
                    if (match[2]) imports.add(match[2]);
                }

                if (imports.size > 0) {
                    try {
                        // pyodide built-in loadPackagesFromImports is good for standard data science packages
                        await pyodide.loadPackagesFromImports(code);
                        // micropip covers pure-python PyPI packages like graphviz
                        await micropip.install(Array.from(imports));
                    } catch (e) {
                        console.warn("Package installation warning:", e);
                    }
                }

                // Python script to set up matplotlib headless and capture the plot as base64 string
                const setupCode = `
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# User code string
user_code = ${JSON.stringify(code)}

# Clear previous plots
plt.clf()

# Execute user code directly into globals to preserve backward compatibility 
exec(user_code, globals())

# Save to base64
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', transparent=True)
buf.seek(0)
img_b64 = base64.b64encode(buf.read()).decode('utf-8')
plt.close()

img_b64
`;

                const result = await pyodide.runPythonAsync(setupCode);

                if (isMounted) {
                    setImgSrc(`data:image/png;base64,${result}`);
                }
            } catch (err: any) {
                console.error("Pyodide error:", err);
                if (isMounted) setError(err.message || String(err));
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        runPython();

        return () => { isMounted = false; };
    }, [isPyodideReady, code]);

    return (
        <div
            style={{ margin: '1rem 0', fontFamily: 'Inter, sans-serif' }}
            data-rendering={loading ? "true" : "false"}
        >
            <Script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js" strategy="lazyOnload" />

            {loading && <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>⏳ Loading...</div>}
            {error && <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '14px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{error}</div>}

            {imgSrc && !loading && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <img src={imgSrc} alt="Python Generated Graph" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </div>
            )}
        </div>
    );
}

