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
  variant: _variant = 'light',
  width = 160,
}) => {
  if (full) {
    const markSize = Math.max(24, Math.round(width * 0.24));
    const titleSize = Math.max(14, Math.round(width * 0.12));
    const taglineSize = Math.max(10, Math.round(width * 0.06));
    const gapSize = Math.max(8, Math.round(width * 0.07));

    return (
      <div
        className={`myspace-logo-full ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${gapSize}px`,
        }}
      >
        <img
          src="/favicon.svg"
          alt="MySpace AI"
          width={markSize}
          height={markSize}
          loading="eager"
          decoding="async"
          className="myspace-logo-mark"
          style={{
            display: 'block',
            width: markSize,
            height: markSize,
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span
            className="auth-brand-name"
            style={{
              fontSize: `${titleSize}px`,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
            }}
          >
            MySpace
            <span
              className="auth-brand-accent"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
                marginLeft: '2px',
              }}
            >
              AI
            </span>
          </span>
          <span
            className="auth-brand-tagline"
            style={{
              fontSize: `${taglineSize}px`,
              fontWeight: 500,
              letterSpacing: '0.02em',
              lineHeight: 1.3,
              color: 'var(--text-tertiary)',
              marginTop: '1px',
            }}
          >
            Your Mind, Organized
          </span>
        </div>
      </div>
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
