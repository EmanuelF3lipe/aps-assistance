import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, setDbPath, closeDb } from './server/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  '&rarr;': '→', '&larr;': '←', '&uarr;': '↑', '&darr;': '↓', '&harr;': '↔',
  '&there4;': '∴', '&alefsym;': 'ℵ', '&infin;': '∞', '&sum;': '∑', '&prod;': '∏',
  '&radic;': '√', '&int;': '∫', '&deg;': '°', '&prime;': '′', '&Prime;': '″',
  '&ne;': '≠', '&le;': '≤', '&ge;': '≥', '&lt;': '<', '&gt;': '>', '&equiv;': '≡',
  '&plus;': '+', '&minus;': '−', '&lowast;': '∗', '&olarr;': '↺', '&oplus;': '⊕',
  '&Delta;': 'Δ', '&Sigma;': 'Σ', '&Omega;': 'Ω', '&alpha;': 'α', '&beta;': 'β',
  '&gamma;': 'γ', '&pi;': 'π', '&sigma;': 'σ', '&tau;': 'τ', '&phi;': 'φ', '&psi;': 'ψ',
  '&nbsp': ' ', '&amp': '&', '&lt': '<', '&gt': '>'
};

function decodeEntities(s, recursive = true) {
  if (!s) return '';
  let out = s;
  // Named entities (longest first)
  const names = Object.keys(ENTITIES).sort((a, b) => b.length - a.length);
  for (const name of names) {
    out = out.split(name).join(ENTITIES[name]);
  }
  // Numeric decimal: &#123;
  out = out.replace(/&#(\d+);/g, (m, d) => {
    const code = Number(d);
    try { return code <= 0x10ffff ? String.fromCodePoint(code) : m; } catch { return m; }
  });
  // Numeric hex: &#x1F4;
  out = out.replace(/&#[xX]([0-9a-fA-F]+);/g, (m, h) => {
    const code = parseInt(h, 16);
    try { return code <= 0x10ffff ? String.fromCodePoint(code) : m; } catch { return m; }
  });
  if (recursive && (out.includes('&#') || /&[a-z]+;/i.test(out))) {
    // one more pass for nested/leftover
    return decodeEntities(out, false);
  }
  return out;
}

/**
 * Re-parses text and re-pairs ** bold markers cleanly.
 * - Collapses adjacent/empty markers (****, ** **, ***)
 * - Trims whitespace inside bold spans
 * - Drops unbalanced dangling markers
 */
function normalizeBold(s) {
  if (!s) return s;
  let t = s;

  // Normalize any run of 2+ stars to **, then collapse empty pairs
  t = t.replace(/={2,}/g, '=='); // prevent accidental collisions (none expected)
  t = t.split('\u0001').join('\u0001');

  // Drop "empty" bold spans: ** ** or **** (after whitespace-inside trimming below)
  // First collapse 3+ stars into 2
  t = t.replace(/\*{3,}/g, '**');

  // Split on **, walking open/close state; inside segments get trimmed.
  const parts = t.split('**');
  let out = '';
  let inside = false;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (inside) {
      const trimmed = seg.trim();
      if (trimmed) {
        out += '**' + trimmed + '**';
      }
    } else {
      out += seg;
    }
    inside = !inside;
  }
  // If we ended "inside" or have an odd dangling marker, parts.length-1 markers toggled;
  // out may contain a trailing ** if the last toggle was an opener. Remove any
  // dangling single markers by re-walking: strip a ** with no following **.
  const markers = out.match(/\*\*/g) || [];
  if (markers.length % 2 !== 0) {
    // Remove the last ** occurrence
    const idx = out.lastIndexOf('**');
    if (idx !== -1) out = out.slice(0, idx) + out.slice(idx + 2);
  }
  return out;
}

/** Converts self-contained code/ySQL blocks into ``` fences. */
function wrapCodeBlocks(s) {
  if (!s) return s;
  const lines = s.split('\n');
  const result = [];
  let i = 0;
  const sqlStart = /^\s*(select|from|where|update|insert|delete|create|drop|alter|exec|execute|declare|begin|commit|rollback|set\s+terminator|grant|revoke|show|with\s|case\b|when\b|end\b|join\b|left\s|right\s|inner\s|full\s|union\b|order\s+by|group\s+by|having\b)\b/i;
  const sqlLookalike = /\b(select|from|where|create table|insert into|update |delete from|drop table|alter table|procedure|trigger|execute|firebird|ibexpert)\b/i;

  while (i < lines.length) {
    const line = lines[i];
    // A code block candidate: line is SQL-starter
    if (sqlStart.test(line) && sqlLookalike.test(line) && line.length < 500) {
      const block = [line];
      i++;
      // continue while next line is also code-like (SQL-y or continuation)
      while (i < lines.length) {
        const nl = lines[i];
        const isCodeContinuation =
          sqlStart.test(nl) ||
          nl.trim() === '' && block.length > 0 ||
          /^\s{2,}/.test(nl) ||
          /[;,]?\s*$/.test(nl) && sqlLookalike.test(block.join(' ')) && nl.trim().length > 0;
        // Hmm: keep it simple — continue while the line contains sql-ish tokens or is blank inside block
        if (sqlLookalike.test(nl) || nl.trim() === '' || /^[\s\t]/.test(nl) || /\b(from|where|select|and|or|join|group by|order by|having|into|values|set\b|=)/i.test(nl)) {
          block.push(nl);
          i++;
        } else {
          break;
        }
      }
      // Only wrap if genuinely multi-statement or looks like code
      const joined = block.join('\n');
      if (/;\s*$|[;]/m.test(joined) || block.length >= 2 && /^\s*[a-z]|select/i.test(block[1])) {
        result.push('```sql\n' + block.map(l => l.trimEnd()).join('\n').trim() + '\n```');
      } else {
        result.push(block.join('\n'));
      }
      continue;
    }
    result.push(line);
    i++;
  }
  return result.join('\n');
}

/** Single-space cleanup between words, preserving intentional newlines. */
function cleanSpacing(s) {
  if (!s) return s;
  return s
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
    .trim();
}

function formatContent(raw) {
  if (!raw) return raw;

  // Split: title / body / metadata / tags
  let content = raw;
  let tags = '';
  const tagIdx = content.indexOf('## Tags');
  if (tagIdx !== -1) {
    tags = content.slice(tagIdx);
    content = content.slice(0, tagIdx);
  }

  // Decode entities everywhere
  content = decodeEntities(content);

  // Move known metadata markers to their own placeholder-removal (dealt with by normalizeBold)
  // Re-pair bold
  content = normalizeBold(content);

  // Extract the `# Title` heading
  let titleLine = '';
  const m = content.match(/^#\s.*$/m);
  if (m) {
    titleLine = m[0];
    content = content.replace(/^#\s.*$/m, '').replace(/^\n+/, '');
  }

  // Wrap SQL blocks
  content = wrapCodeBlocks(content);

  // Clean spacing
  content = cleanSpacing(content);

  // Normalize "-" list items with single space
  content = content.replace(/^-\s+/gm, '- ');

  // Reassemble
  const tagClean = decodeEntities(tags).split('\n').map(l => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n');
  // ensure tags preserved
  let out = titleLine ? titleLine + '\n' : '';
  out += content.trim() + '\n';
  if (tagClean && tagClean.trim()) out += '\n' + tagClean.trim() + '\n';
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

async function main() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'aps-assistance.db');
  setDbPath(dbPath);
  const db = getDb();

  const all = db.prepare('SELECT id, name, content FROM files WHERE content LIKE ?').all('%Base de Conhecimento GLPI%');
  console.log(`Formatando ${all.length} arquivos importados do GLPI...`);

  const upd = db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  let changed = 0;
  for (const f of all) {
    const newContent = formatContent(f.content || '');
    if (newContent !== (f.content || '')) {
      upd.run(newContent, f.id);
      changed++;
    }
  }
  console.log(`Registros atualizados: ${changed}`);

  // Preview a couple
  const preview = db.prepare('SELECT name, content FROM files WHERE content LIKE ? ORDER BY id').all('%Base de Conhecimento GLPI%');
  for (const name of ['Dicas: Destacar  IRRF na NFe', 'Dicas: Comandos do SQL', 'Validação: Este Cliente encontra-se com parcelas em atraso na empresa. Algum usuário vai poder liberar?', 'Migração do firebird 2.5 para 3.0 - LUNIO']) {
    const f = preview.find(x => x.name === name);
    if (f) {
      console.log('\n==========', f.name, '==========');
      console.log(f.content.split('## Tags')[0].slice(0, 900));
    }
  }

  closeDb();
  console.log('\nConcluído!');
}

main();