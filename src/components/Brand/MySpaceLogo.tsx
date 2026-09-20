import React from 'react';

interface MySpaceLogoProps {
  size?: number;
  className?: string;
  full?: boolean;
  variant?: 'light' | 'dark';
  width?: number;
}

/**
 * MySpace AI brand logo.
 *
 * Default (full=false): renders the authentic folded-ribbon 3D gradient M brand mark
 *   with exact 1:1 aspect ratio, matching the high-resolution vector/favicon.svg.
 *
 * Full logo (full=true): renders the complete MySpace AI logo with typography.
 */
export const MySpaceLogo: React.FC<MySpaceLogoProps> = ({
  size = 24,
  className = '',
  full = false,
  variant = 'light',
  width = 160,
}) => {
  if (full) {
    const src = variant === 'dark' ? '/logo-full-dark-bg.png' : '/logo.png';
    return (
      <img
        src={src}
        alt="MySpace AI"
        width={width}
        height={Math.round(width * 0.35)}
        loading="eager"
        decoding="async"
        className={`myspace-logo-full ${className}`}
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
    );
  }

  // ── Authentic M Ribbon Brand Mark ─────────────────────────────────────────
  return (
    <img
      src="/favicon.svg"
      alt="MySpace AI"
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      className={`myspace-logo-mark ${className}`}
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
};
