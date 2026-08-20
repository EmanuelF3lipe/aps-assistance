import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, setDbPath, closeDb } from './server/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://atendimento.apsinformatica.com.br';
const GLPI_USER = 'EMANUEL_APS';
const GLPI_PASS = '1q2w3e!Q@W#E';

let cookieJar = {};
function updateCookies(sc) {
  if (!sc) return;
  const arr = Array.isArray(sc) ? sc : [sc];
  for (const raw of arr) {
    const parts = raw.split(';');
    const eq = parts[0].indexOf('=');
    if (eq > 0) cookieJar[parts[0].substring(0, eq)] = parts[0].substring(eq + 1);
  }
}
const cookieHeader = () => Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');

async function get(url, extra = {}) {
  const res = await fetch(url, { ...extra, redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Cookie: cookieHeader(), ...(extra.headers || {}) } });
  updateCookies(res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []));
  await new Promise(r => setTimeout(r, 500));
  return res;
}

function decodeEntities(s) {
  if (!s) return '';
  const map = { '&nbsp;': ' ', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú', '&ccedil;': 'ç', '&atilde;': 'ã', '&otilde;': 'õ', '&circ;': '^', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  return s.replace(/&[a-z]+;/gi, m => map[m.toLowerCase()] || m).replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#[xX]([0-9a-fA-F]+);/g, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
}

function htmlToMarkdown(html) {
  if (!html) return '';
  let h = html;
  h = h.replace(/<br\s*\/?\s*>/gi, '\n');
  h = h.replace(/<\/p>/gi, '\n\n');
  h = h.replace(/<\/li>/gi, '\n');
  h = h.replace(/<li[^>]*>/gi, '- ');
  h = h.replace(/<\/h([1-6])>/gi, '\n\n');
  h = h.replace(/<h([1-6])[^>]*>/gi, (m, n) => '#'.repeat(Number(n)) + ' ');
  h = h.replace(/<strong[^>]*>/gi, '**').replace(/<\/strong>/gi, '**');
  h = h.replace(/<em[^>]*>/gi, '*').replace(/<\/em>/gi, '*');
  h = h.replace(/<[^>]+>/g, '');
  h = decodeEntities(h);
  h = h.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return h;
}

async function login() {
  const page = await get(BASE + '/index.php');
  const html = await page.text();
  const token = (html.match(/name="_glpi_csrf_token"[^>]*value="([^"]+)"/) || [])[1];
  const fieldNames = [...html.matchAll(/<(?:input|select|textarea)[^>]*name="(field[a-f0-9]+)"[^>]*>/g)].map(m => m[1]);
  const body = new URLSearchParams();
  body.set('noAUTO', '1'); body.set('redirect', ''); body.set('_glpi_csrf_token', token);
  for (let i = 0; i < fieldNames.length; i++) {
    if (i === 0) body.set(fieldNames[i], GLPI_USER);
    else if (i === 1) body.set(fieldNames[i], GLPI_PASS);
    else body.set(fieldNames[i], '');
  }
  await get(BASE + '/front/login.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  console.log('logged in');
}

async function fetchArticle(id) {
  const tabUrl = `${BASE}/ajax/common.tabs.php?_glpi_tab=KnowbaseItem%241&item_itemtype=&item_items_id=&_target=%2Ffront%2Fknowbaseitem.form.php&_itemtype=KnowbaseItem&id=${id}`;
  const res = await get(tabUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  const txt = await res.text();
  const title = (txt.match(/<h2>Assunto<\/h2>\s*([^<]+)/) || [])[1]?.trim() || '';
  const contentHtml = (txt.match(/id='kbanswer'>([\s\S]*?)<\/div>/) || [])[1] || '';
  const author = (txt.match(/Autor:\s*([^<]+)/) || [])[1]?.trim() || '';
  const created = (txt.match(/Criado em\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9:]+)/) || [])[1] || '';
  const updated = (txt.match(/ltima atualiza..o em\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9:]+)/) || [])[1] || '';
  return { id, title: decodeEntities(title), author, created, updated, content: htmlToMarkdown(contentHtml) };
}

async function main() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'aps-assistance.db');
  setDbPath(dbPath);
  const db = getDb();
  await login();

  const retry = db.prepare("SELECT id AS fileId, name FROM files WHERE content LIKE '%Falha ao baixar artigo%'").all();
  console.log(`retrying ${retry.length} articles`);

  const getFile = db.prepare('SELECT * FROM files WHERE name = ?');
  const updateFile = db.prepare('UPDATE files SET name = ?, content = ? WHERE id = ?');
  const getFolder = db.prepare('SELECT id FROM folders WHERE name = ?');

  for (const item of retry) {
    // extract article id from name
    const artId = Number((item.name.match(/(\d+)/) || [])[1]);
    if (!artId) continue;
    const a = await fetchArticle(artId);
    const folder = getFolder.get('LINKS/DICAS ÚTEIS');
    const file = getFile.get(item.name);
    const content = [
      `# ${a.title}`,
      '',
      a.content,
      '',
      '---',
      a.author ? `**Autor:** ${a.author}` : '',
      a.created ? `**Criado em:** ${a.created}` : '',
      a.updated ? `**Última atualização:** ${a.updated}` : '',
      `**Fonte:** Base de Conhecimento GLPI (artigo #${artId})`,
      '',
      '## Tags',
      '- glpi',
      '- base de conhecimento',
      'LINKS/DICAS ÚTEIS'
    ].join('\n');
    updateFile.run(a.title, content, file.id);
    console.log(`updated #${artId}: "${a.title}" (${file.id})`);
  }

  console.log('done');
  closeDb();
}

main();