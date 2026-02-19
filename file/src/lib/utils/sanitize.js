const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's',
  'a', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'span', 'div', 'sub', 'sup',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

/**
 * Server-side HTML sanitizer that strips disallowed tags and attributes.
 * Avoids jsdom dependency issues with isomorphic-dompurify in Next.js SSR.
 */
function serverSanitize(html) {
  if (!html) return '';

  // Remove script/style/iframe tags and their content entirely
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|textarea|button|select)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove self-closing dangerous tags
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|textarea|button|select)[^>]*\/?>/gi, '');
  // Remove event handler attributes (onclick, onerror, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');

  // Strip disallowed tags (keep content, remove tags)
  const allowedPattern = ALLOWED_TAGS.join('|');
  const tagRegex = new RegExp(`<\\/?((?!(?:${allowedPattern})\\b)[a-z][a-z0-9]*)\\b[^>]*>`, 'gi');
  clean = clean.replace(tagRegex, '');

  // Strip disallowed attributes from remaining tags
  const attrAllowedPattern = ALLOWED_ATTR.join('|');
  clean = clean.replace(/<([a-z][a-z0-9]*)\s+([^>]*)>/gi, (match, tag, attrs) => {
    const cleanAttrs = [];
    const attrRegex = /([a-z-]+)\s*=\s*("[^"]*"|'[^']*')/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      if (new RegExp(`^(?:${attrAllowedPattern})$`).test(attrName)) {
        cleanAttrs.push(attrMatch[0]);
      }
    }
    return cleanAttrs.length > 0 ? `<${tag} ${cleanAttrs.join(' ')}>` : `<${tag}>`;
  });

  return clean;
}

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify on client, regex-based sanitizer on server.
 */
export function sanitizeHtml(html) {
  if (!html) return '';

  if (typeof window !== 'undefined') {
    // Client-side: use DOMPurify (loaded dynamically)
    try {
      const DOMPurify = require('dompurify');
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
      });
    } catch {
      return serverSanitize(html);
    }
  }

  // Server-side: use regex-based sanitizer
  return serverSanitize(html);
}
