'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Renders text that may contain LaTeX expressions.
 * - Inline math: $...$
 * - Display math: $$...$$
 * 
 * Non-math text is rendered as plain text.
 */
export default function MathText({ text, className, style }: {
    text: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    if (!text) return null;

    // Split text by LaTeX delimiters, preserving them
    // Match $$...$$ (display) first, then $...$ (inline)
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g);

    const rendered = parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
            // Display math
            const latex = part.slice(2, -2).trim();
            try {
                const html = katex.renderToString(latex, {
                    displayMode: true,
                    throwOnError: false,
                    trust: true,
                });
                return (
                    <span
                        key={i}
                        className="math-display"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                );
            } catch {
                return <span key={i}>{part}</span>;
            }
        } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            // Inline math
            const latex = part.slice(1, -1).trim();
            try {
                const html = katex.renderToString(latex, {
                    displayMode: false,
                    throwOnError: false,
                    trust: true,
                });
                return (
                    <span
                        key={i}
                        className="math-inline"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                );
            } catch {
                return <span key={i}>{part}</span>;
            }
        } else {
            return <span key={i}>{part}</span>;
        }
    });

    return <span className={className} style={style}>{rendered}</span>;
}
