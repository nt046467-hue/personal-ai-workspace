/**
 * Security utilities for URL validation, external navigation, and XSS prevention.
 */

/**
 * Validate that a URL string is safe to navigate to or open in a browser.
 * Strictly permits only http: and https: protocols to protect against javascript: and data: XSS.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Safely open an external URL in a new tab with noopener,noreferrer
 */
export function openSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url || !isSafeHttpUrl(url)) {
    console.warn('[Security] Refused to open unsafe URL:', url);
    return false;
  }
  window.open(url.trim(), '_blank', 'noopener,noreferrer');
  return true;
}
