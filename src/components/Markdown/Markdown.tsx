import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Copy, Check } from 'lucide-react';
import { isSafeHttpUrl } from '../../utils/security';
import './Markdown.css';

interface MarkdownProps {
  content: string;
  className?: string;
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), 'className'],
  },
};

const CodeRenderer: React.FC<{
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}> = ({ className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children || '').replace(/\n$/, '');
  const isInline = !match && !codeString.includes('\n');

  if (isInline) {
    return (
      <code className="markdown-inline-code" {...props}>
        {children}
      </code>
    );
  }

  const language = match ? match[1] : 'code';

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="markdown-code-block-wrapper">
      <div className="markdown-code-block-header">
        <span className="markdown-code-language">{language}</span>
        <button
          type="button"
          className="markdown-code-copy-btn"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="markdown-code-scroll">
        <pre className="markdown-pre">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
};

export const Markdown: React.FC<MarkdownProps> = ({ content, className }) => {
  return (
    <div className={`markdown-renderer ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          code: CodeRenderer,
          pre: ({ children }) => <>{children}</>,
          table: ({ children, ...props }) => (
            <div className="markdown-table-wrapper">
              <table className="markdown-table" {...props}>
                {children}
              </table>
            </div>
          ),
          a: ({ href, children, ...props }) => {
            const isSafe = isSafeHttpUrl(href);
            if (!isSafe || !href) {
              return <span>{children}</span>;
            }
            return (
              <a
                href={href}
                className="markdown-link"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
