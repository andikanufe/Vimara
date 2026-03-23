'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
    interface Window {
        loadPyodide: (config: { indexURL: string }) => Promise<any>;
        pyodide: any;
    }
}

const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const renderQueue: Array<() => void> = [];

const imageCache = new Map<string, string>();
const inFlightRenders = new Map<string, Promise<string>>();
let pyodideInitPromise: Promise<any> | null = null;
let pyodideBasePackagesPromise: Promise<void> | null = null;

function runWithQueue<T>(job: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const start = () => {
            activeRenders += 1;
            job()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    activeRenders -= 1;
                    const next = renderQueue.shift();
                    if (next) next();
                });
        };

        if (activeRenders < MAX_CONCURRENT_RENDERS) {
            start();
        } else {
            renderQueue.push(start);
        }
    });
}

async function getPyodideInstance() {
    if (window.pyodide) return window.pyodide;
    if (!pyodideInitPromise) {
        pyodideInitPromise = window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
        }).then((instance) => {
            window.pyodide = instance;
            return instance;
        });
    }
    return pyodideInitPromise;
}

async function ensureBasePackages(pyodide: any) {
    if (!pyodideBasePackagesPromise) {
        pyodideBasePackagesPromise = pyodide.loadPackage(['matplotlib', 'micropip']);
    }
    await pyodideBasePackagesPromise;
}

function extractImports(code: string): string[] {
    const imports = new Set<string>();
    const regex = /^(?:from\s+([a-zA-Z0-9_]+)|\s*import\s+([a-zA-Z0-9_]+)(?:\s+as\s+[a-zA-Z0-9_]+)?)/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
        if (match[1]) imports.add(match[1]);
        if (match[2]) imports.add(match[2]);
    }
    return Array.from(imports);
}

async function renderGraphImage(code: string): Promise<string> {
    const cached = imageCache.get(code);
    if (cached) return cached;

    const existingTask = inFlightRenders.get(code);
    if (existingTask) return existingTask;

    const task = runWithQueue(async () => {
        const pyodide = await getPyodideInstance();
        await ensureBasePackages(pyodide);

        const imports = extractImports(code);
        if (imports.length > 0) {
            try {
                await pyodide.loadPackagesFromImports(code);
                const micropip = pyodide.pyimport('micropip');
                await micropip.install(imports);
            } catch (e) {
                console.warn("Package installation warning:", e);
            }
        }

        const setupCode = `
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

user_code = ${JSON.stringify(code)}

plt.clf()
exec(user_code, globals())

buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', transparent=True)
buf.seek(0)
img_b64 = base64.b64encode(buf.read()).decode('utf-8')
plt.close()

img_b64
`;

        const result = await pyodide.runPythonAsync(setupCode);
        const src = `data:image/png;base64,${result}`;
        imageCache.set(code, src);
        return src;
    }).finally(() => {
        inFlightRenders.delete(code);
    });

    inFlightRenders.set(code, task);
    return task;
}

export default function PythonGraph({ code, deferUntilVisible = true }: { code: string; deferUntilVisible?: boolean }) {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPyodideReady, setIsPyodideReady] = useState(false);
    const [isVisible, setIsVisible] = useState(!deferUntilVisible);
    const containerRef = useRef<HTMLDivElement | null>(null);

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
        if (!deferUntilVisible) {
            setIsVisible(true);
            return;
        }

        const target = containerRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        observer.disconnect();
                        break;
                    }
                }
            },
            { root: null, rootMargin: '300px 0px', threshold: 0.01 }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [deferUntilVisible]);

    useEffect(() => {
        if (!isPyodideReady || !code || !isVisible) return;

        let isMounted = true;

        async function runPython() {
            if (!isMounted) return;
            setLoading(true);
            setError(null);
            setImgSrc(imageCache.get(code) ?? null);

            try {
                const result = await renderGraphImage(code);

                if (isMounted) {
                    setImgSrc(result);
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
    }, [isPyodideReady, code, isVisible]);

    return (
        <div
            ref={containerRef}
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