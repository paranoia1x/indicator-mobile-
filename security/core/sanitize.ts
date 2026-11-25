/**
 * Sanitisation utilities for EXTERNAL content (news, filings, provider strings, AI output).
 * External text is always rendered as plain text — never as HTML or executable markup.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Zero-width, bidi-override and other invisible characters used to hide injected text. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Converts untrusted HTML/text to safe, bounded plain text. */
export function toPlainText(input: unknown, maxLength = 4000): string {
  if (typeof input !== 'string') return '';
  let s = input
    .replace(/<(script|style|iframe|object|embed|noscript|template)[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/<[^>]*>/g, ' '); // entity-encoded tags decoded above
  s = s.replace(INVISIBLE, '');
  s = s.replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > maxLength) s = s.slice(0, maxLength - 1).trimEnd() + '…';
  return s;
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

/**
 * Whether a URL from external content may be opened in the system browser:
 * https only, no embedded credentials, no private/loopback hosts, bounded length.
 */
export function isSafeExternalUrl(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (!u.hostname || PRIVATE_HOST.test(u.hostname)) return false;
  return true;
}

/**
 * Validates a user-configured backend base URL. HTTPS is required except for loopback/LAN
 * development hosts, which are allowed over http only when `allowInsecureDev` is true.
 */
export function validateBackendUrl(raw: string, allowInsecureDev: boolean): { ok: true; url: string } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'Not a valid URL.' };
  }
  if (u.username || u.password) return { ok: false, reason: 'URLs with embedded credentials are not allowed.' };
  const isDevHost = PRIVATE_HOST.test(u.hostname);
  if (u.protocol === 'http:' && !(allowInsecureDev && isDevHost)) {
    return { ok: false, reason: 'HTTPS is required (plain HTTP is only allowed for local development hosts).' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: 'Only http(s) URLs are supported.' };
  if (u.search || u.hash) return { ok: false, reason: 'Base URL must not contain a query string or fragment.' };
  return { ok: true, url: u.toString().replace(/\/+$/, '') };
}

/** Redacts secrets and personal data from strings before they are logged. */
export function redact(input: string): string {
  return input
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._\-~+/]+=*/g, '$1 [REDACTED]')
    .replace(/(x-api-key|api[_-]?key|apca-api-[a-z-]+|token|secret|password)(["'\s:=]+)(?!Bearer )([^\s"',;&]+)/gi, '$1$2[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[REDACTED_KEY]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[REDACTED_HEX]');
}

/** Wallet seed phrases / private keys must never be requested or stored. Detects likely pastes. */
export function looksLikeSecretMaterial(text: string): boolean {
  const words = text.trim().toLowerCase().split(/\s+/);
  const seedLike = (words.length === 12 || words.length === 24) && words.every((w) => /^[a-z]{3,8}$/.test(w));
  const privKey = /\b(0x)?[0-9a-f]{64}\b/i.test(text) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text);
  return seedLike || privKey;
}
