import React from 'react';

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
}

/**
 * Renders text with matching query terms wrapped in safe <mark> elements.
 * Eliminates the need for dangerouslySetInnerHTML when highlighting search results.
 */
export const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className }) => {
  if (!query || !query.trim() || !text) {
    return <span className={className}>{text}</span>;
  }

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="search-highlight-mark">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};
