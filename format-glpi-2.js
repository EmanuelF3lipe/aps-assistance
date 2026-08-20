const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú',
  '&acirc;': 'â', '&ecirc;': 'ê', '&icirc;': 'î', '&ocirc;': 'ô', '&ucirc;': 'û',
  '&atilde;': 'ã', '&otilde;': 'õ', '&ntilde;': 'ñ', '&ccedil;': 'ç',
  '&agrave;': 'à', '&egrave;': 'è', '&igrave;': 'ì', '&ograve;': 'ò', '&ugrave;': 'ù',
  '&auml;': 'ä', '&euml;': 'ë', '&iuml;': 'ï', '&ouml;': 'ö', '&uuml;': 'ü',
  '&aring;': 'å', '&oslash;': 'ø', '&aelig;': 'æ', '&szlig;': 'ß',
  '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú',
  '&Acirc;': 'Â', '&Ecirc;': 'Ê', '&Icirc;': 'Î', '&Ocirc;': 'Ô', '&Ucirc;': 'Û',
  '&Atilde;': 'Ã', '&Otilde;': 'Õ', '&Ntilde;': 'Ñ', '&Ccedil;': 'Ç',
  '&Agrave;': 'À', '&Egrave;': 'È', '&Igrave;': 'Ì', '&Ograve;': 'Ò', '&Ugrave;': 'Ù',
  '&Auml;': 'Ä', '&Euml;': 'Ë', '&Iuml;': 'Ï', '&Ouml;': 'Ö', '&Uuml;': 'Ü',
  '&ordm;': 'º', '&ordf;': 'ª', '&deg;': '°', '&copy;': '©', '&reg;': '®', '&trade;': '™',
  '&middot;': '·', '&bull;': '•', '&hellip;': '…', '&ndash;': '–', '&mdash;': '—',
  '&lsquo;': '‘', '&rsquo;': '’', '&sbquo;': '‚', '&ldquo;': '“', '&rdquo;': '”', '&bdquo;': '„',
  '&laquo;': '«', '&raquo;': '»', '&times;': '×', '&divide;': '÷', '&plusmn;': '±',
  '&euro;': '€', '&pound;': '£', '&yen;': '¥', '&cent;': '¢', '&curren;': '¤',
  '&micro;': 'µ', '&para;': '¶', '&sect;': '§', '&not;': '¬', '&sup1;': '¹', '&sup2;': '²', '&sup3;': '³',
  '&frac14;': '¼', '&frac12;': '½', '&frac34;': '¾', '&iexcl;': '¡', '&iquest;': '¿',
  '&rarr;': '→', '&larr;': '←', '&uarr;': '↑', '&darr;': '↓', '&harr;': '↔', '&ne;': '≠',
  '&le;': '≤', '&ge;': '≥', '&equiv;': '≡', '&Delta;': 'Δ', '&Sigma;': 'Σ', '&Omega;': 'Ω',
  '&alpha;': 'α', '&beta;': 'β', '&gamma;': 'γ', '&pi;': 'π', '&sigma;': 'σ', '&tau;': 'τ'
};

function decodeEntities(s, recursive = true) {
  if (!s) return '';
  let out = s;
  const names = Object.keys(ENTITIES).sort((a, b) => b.length - a.length);
  for (const name of names) out = out.split(name).join(ENTITIES[name]);
  out = out.replace(/&#(\d+);/g, (m, d) => { try { return Number(d) <= 0x10ffff ? String.fromCodePoint(Number(d)) : m; } catch { return m; } });
  out = out.replace(/&#[xX]([0-9a-fA-F]+);/g, (m, h) => { try { const c = parseInt(h, 16); return c <= 0x10ffff ? String.fromCodePoint(c) : m; } catch { return m; } });
  if (recursive && (out.includes('&#') || /&[a-z]+;/i.test(out))) return decodeEntities(out, false);
  return out;
}

function normalizeBold(s) {
  if (!s) return s;
  let t = s;
  // Collapse 3+ stars: even runs (4,6,8) = close+reopen adjacent -> drop;
  // odd runs (3,5) -> single marker
  t = t.replace(/\*{3,}/g, m => (m.length % 2 === 0 ? '' : '**'));
  // Remove empty/invisible pairs: "**  **" -> single space (repeat until stable)
  let prev;
  do {
    prev = t;
    t = t.replace(/\*\*\s+\*\*/g, ' ');
  } while (t !== prev);
  // Drop a single dangling marker if total count is odd
  const cnt = (t.match(/\*\*/g) || []).length;
  if (cnt % 2 !== 0) {
    const idx = t.lastIndexOf('**');
    if (idx !== -1) t = t.slice(0, idx) + t.slice(idx + 2);
  }
  return t;
}

function cleanSpacing(s) {
  if (!s) return s;
  return s
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatContent(raw) {
  if (!raw) return raw;
  let content = raw;
  let tags = '';
  const tagIdx = content.indexOf('## Tags');
  if (tagIdx !== -1) {
    tags = content.slice(tagIdx);
    content = content.slice(0, tagIdx);
  }
  content = decodeEntities(content);

  let titleLine = '';
  const m = content.match(/^#\s.*$/m);
  if (m) {
    titleLine = m[0];
    content = content.replace(/^#\s.*$/m, '').replace(/^\n+/, '');
  }
  titleLine = cleanSpacing(titleLine);

  content = normalizeBold(content);
  content = cleanSpacing(content);

  const tagClean = cleanSpacing(decodeEntities(tags));
  let out = titleLine ? titleLine + '\n' : '';
  out += (content.trim() || '') + '\n';
  if (tagClean && tagClean.trim()) out += '\n' + tagClean.trim() + '\n';
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---- Renderer simulation (matches ErrorPopup.renderContent) ----
export function simulateRender(md) {
  if (!md) return '';
  let html = md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^- (.*$)/gm, '• $1')
    .replace(/\n/g, '<br>');
  return html;
}