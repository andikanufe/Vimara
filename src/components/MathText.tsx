'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import dynamic from 'next/dynamic';

const PythonGraph = dynamic(() => import('./PythonGraph'), { ssr: false });
const TikzGraph = dynamic(() => import('./TikzGraph'), { ssr: false });

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

    // 1. Separate special blocks (Python & Display Math & Tables) that can be multi-line
    // We keep $...$ (inline) within the text segments for now
    const segments = text.split(/(\[python\][\s\S]*?\[\/python\]|\[tikz\][\s\S]*?\[\/tikz\]|\[table\][\s\S]*?\[\/table\]|\[img\][\s\S]*?\[\/img\]|\$\$[\s\S]*?\$\$)/g);

    return (
        <div className={className} style={{ ...style, whiteSpace: 'pre-wrap' }}>
            {segments.map((segment, segIdx) => {
                if (segment.startsWith('[tikz]') && segment.endsWith('[/tikz]')) {
                    const code = segment.slice(6, -7).trim();
                    return <TikzGraph key={segIdx} code={code} />;
                }

                if (segment.startsWith('[img]') && segment.endsWith('[/img]')) {
                    let url = segment.slice(5, -6).trim();
                    const gdriveMatch = url.match(/(?:file\/d\/|id=|folders\/)([\w-]{25,})/);
                    if (gdriveMatch && gdriveMatch[1]) {
                        url = `https://drive.google.com/thumbnail?id=${gdriveMatch[1]}&sz=w1000`;
                    }
                    return (
                        <div key={segIdx} style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
                            <img src={url} alt="Gambar" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        </div>
                    );
                }

                if (segment.startsWith('[python]') && segment.endsWith('[/python]')) {
                    const code = segment.slice(8, -9).trim();
                    return <PythonGraph key={segIdx} code={code} />;
                }

                if (segment.startsWith('[table]') && segment.endsWith('[/table]')) {
                    const content = segment.slice(7, -8).trim();
                    const tableRows = content.split('\n');
                    return (
                        <div key={segIdx} style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
                            <table style={{ borderCollapse: 'collapse', width: 'auto', minWidth: '100%', border: '1px solid #ddd' }}>
                                <tbody>
                                    {tableRows.map((row, rIdx) => {
                                        const cells = row.split('|');
                                        return (
                                            <tr key={rIdx}>
                                                {cells.map((cell, cIdx) => (
                                                    <td key={cIdx} style={{
                                                        border: '1px solid #ddd',
                                                        padding: '0.4rem 0.6rem',
                                                        fontSize: 'inherit'
                                                    }}>
                                                        <MathText text={cell.trim()} />
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                }

                if (segment.startsWith('$$') && segment.endsWith('$$')) {
                    const latex = segment.slice(2, -2).trim();
                    try {
                        const html = katex.renderToString(latex, {
                            displayMode: true,
                            throwOnError: false,
                            trust: true,
                        });
                        return (
                            <div
                                key={segIdx}
                                className="math-display"
                                style={{ margin: '0.5rem 0' }}
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        );
                    } catch {
                        return <div key={segIdx}>{segment}</div>;
                    }
                }

                // 2. For text segments, split by lines and handle hanging indents
                const lines = segment.split('\n');

                return lines.map((line, lineIdx) => {
                    if (line === '' && lineIdx > 0) return <div key={`${segIdx}-${lineIdx}`} style={{ height: '0.5em' }} />;

                    // Render --- as a horizontal rule
                    if (line.trim() === '---') {
                        return <hr key={`${segIdx}-${lineIdx}`} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />;
                    }

                    // Detect bullet list items starting with "- " or "• "
                    const isBullet = /^(\s*[-•]\s)/.test(line);
                    const lineContent = isBullet ? line.replace(/^\s*[-•]\s/, '') : line;

                    // Regex to detect (1), 1., a., etc. at the start of a line
                    const numberingRegex = /^(\s*)(\(?[\d|a-z|A-Z]+\)?[\.|\)])(\s+)/;
                    const match = lineContent.match(numberingRegex);
                    const isNumbering = !!match && !isBullet;

                    // Split line by **bold** and inline LaTeX $...$
                    const parts = lineContent.split(/(\*\*[^*]+?\*\*|\$[^$]+?\$)/g);
                    const renderedLine = parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                            const boldText = part.slice(2, -2);
                            // Still parse LaTeX inside bold
                            const innerParts = boldText.split(/(\$[^$]+?\$)/g);
                            return <strong key={i}>{innerParts.map((ip, ii) => {
                                if (ip.startsWith('$') && ip.endsWith('$') && ip.length > 2) {
                                    const latex = ip.slice(1, -1).trim();
                                    try {
                                        const html = katex.renderToString(latex, { displayMode: false, throwOnError: false, trust: true });
                                        return <span key={ii} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
                                    } catch { return <span key={ii}>{ip}</span>; }
                                }
                                return <span key={ii}>{ip}</span>;
                            })}</strong>;
                        }
                        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
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
                        }
                        return <span key={i}>{part}</span>;
                    });

                    const lineStyle = isNumbering ? {
                        paddingLeft: '1.75rem',
                        textIndent: '-1.75rem',
                        marginBottom: '0.1rem'
                    } : {};

                    // Use a div for each line to ensure block behavior and support hanging indent
                    return (
                        <div key={`${segIdx}-${lineIdx}`} style={lineStyle}>
                            {renderedLine}
                        </div>
                    );
                });
            })}
        </div>
    );
}
