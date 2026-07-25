const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  span: new Set(['style']),
  div: new Set(['style']),
  p: new Set(['style']),
  h1: new Set(['style']),
  h2: new Set(['style']),
  h3: new Set(['style']),
  h4: new Set(['style']),
  h5: new Set(['style']),
  h6: new Set(['style']),
};

/** Lightweight allowlist sanitizer for branding HTML (no script/event handlers). */
export function sanitizeBrandingHtml(input: string | undefined | null): string {
  if (!input) return '';
  let html = String(input);

  // Strip dangerous constructs early
  html = html
    .replace(/<\s*(script|iframe|object|embed|form|link|meta|style)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|form|link|meta|style)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');

  return html.replace(
    /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g,
    (full, tagName: string, attrs = '') => {
      const tag = tagName.toLowerCase();
      const closing = full.startsWith('</');
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (closing) return `</${tag}>`;
      if (tag === 'br') return '<br/>';

      const allowed = ALLOWED_ATTRS[tag];
      if (!allowed || !attrs.trim()) return `<${tag}>`;

      const kept: string[] = [];
      const attrRe =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let match: RegExpExecArray | null;
      while ((match = attrRe.exec(attrs)) !== null) {
        const name = match[1].toLowerCase();
        if (!allowed.has(name)) continue;
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        if (name === 'href' && /^\s*javascript:/i.test(value)) continue;
        if (name === 'style' && /expression|url\s*\(|javascript/i.test(value)) {
          continue;
        }
        const safe = value.replace(/"/g, '&quot;');
        kept.push(`${name}="${safe}"`);
        if (name === 'href' && !kept.some((k) => k.startsWith('rel='))) {
          kept.push('rel="noopener noreferrer"');
        }
      }
      return kept.length ? `<${tag} ${kept.join(' ')}>` : `<${tag}>`;
    },
  );
}
