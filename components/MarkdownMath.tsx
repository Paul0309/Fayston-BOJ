"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MarkdownMathProps {
    content?: string | null;
    className?: string;
    statementMode?: boolean;
}

export default function MarkdownMath({ content, className, statementMode = false }: MarkdownMathProps) {
    if (!content) return null;
    const normalized = content
        .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr: string) => `$$${expr}$$`)
        .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, expr: string) => `$${expr}$`);

    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={
                    statementMode
                        ? {
                              p: ({ children }) => <p className="my-3 leading-8">{children}</p>,
                              ul: ({ children }) => <ul className="my-3 list-disc pl-6 space-y-1.5">{children}</ul>,
                              ol: ({ children }) => <ol className="my-3 list-decimal pl-6 space-y-1.5">{children}</ol>,
                              li: ({ children }) => <li className="leading-8">{children}</li>
                          }
                        : undefined
                }
            >
                {normalized}
            </ReactMarkdown>
        </div>
    );
}
