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
  /**
   * When provided, task-list checkboxes become interactive.
   * Called with the ordinal index of the checkbox among all task-list items
   * in the document (0-based) and its new checked state.
   */
  onTaskToggle?: (taskIndex: number, checked: boolean) => void;
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'mark', 'input'],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    // Allow type, checked, disabled on <input> so GFM task-list checkboxes
    // survive sanitization. Without this they are silently stripped.
    input: ['type', 'checked', 'disabled'],
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

export const Markdown: React.FC<MarkdownProps> = ({ content, className, onTaskToggle }) => {
  // Plain mutable object — created fresh every render, so ordinal counts are
  // always in sync with the markdown source. Each InputRenderer call increments
  // counter.n to capture its ordinal position. No ref mutation needed.
  const counter = { n: 0 };

  const InputRenderer: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
    if (props.type !== 'checkbox') {
      return <input {...props} />;
    }

    // Capture the ordinal index for this checkbox at render time
    const myIndex = counter.n;
    counter.n += 1;

    if (onTaskToggle) {
      return (
        <input
          {...props}
          type="checkbox"
          disabled={false}
          className="markdown-task-checkbox"
          onChange={(e) => onTaskToggle(myIndex, e.target.checked)}
        />
      );
    }

    // Read-only mode (no handler provided — e.g. AI chat view)
    return (
      <input
        {...props}
        type="checkbox"
        disabled
        readOnly
        className="markdown-task-checkbox markdown-task-checkbox--readonly"
      />
    );
  };

  return (
    <div className={`markdown-renderer ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          code: CodeRenderer,
          pre: ({ children }) => <>{children}</>,
          input: InputRenderer,
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
