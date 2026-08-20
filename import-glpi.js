import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, setDbPath, closeDb } from './server/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://atendimento.apsinformatica.com.br';
const GLPI_USER = 'EMANUEL_APS';
const GLPI_PASS = '1q2w3e!Q@W#E';
const LIST_FILE = process.env.LIST_FILE || 'C:/Users/APS/AppData/Local/Temp/opencode/glpi-all-items.json';

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
let csrfToken = '';

async function get(url, extra = {}) {
  const res = await fetch(url, { ...extra, redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Cookie: cookieHeader(), ...(extra.headers || {}) } });
  updateCookies(res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []));
  await new Promise(r => setTimeout(r, 350));
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
  const kb = await get(BASE + '/front/knowbaseitem.php');
  csrfToken = ((await kb.text()).match(/name="_glpi_csrf_token"[^>]*value="([^"]+)"/) || [])[1] || token;
  return true;
}

async function fetchArticle(id, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tabUrl = `${BASE}/ajax/common.tabs.php?_glpi_tab=KnowbaseItem%241&item_itemtype=&item_items_id=&_target=%2Ffront%2Fknowbaseitem.form.php&_itemtype=KnowbaseItem&id=${id}`;
      const res = await get(tabUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const txt = await res.text();
      if (txt.includes('Acesso negado') || txt.includes('login') && txt.length < 2000) {
        throw new Error('not logged in');
      }
      const title = (txt.match(/<h2>Assunto<\/h2>\s*([^<]+)/) || [])[1]?.trim() || '';
      const contentHtml = (txt.match(/id='kbanswer'>([\s\S]*?)<\/div>/) || [])[1] || '';
      const author = (txt.match(/Autor:\s*([^<]+)/) || [])[1]?.trim() || '';
      const created = (txt.match(/Criado em\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9:]+)/) || [])[1] || '';
      const updated = (txt.match(/ltima atualiza..o em\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9:]+)/) || [])[1] || '';
      if (!title && !contentHtml) throw new Error('empty response');
      return { id, title: decodeEntities(title), author, created, updated, content: htmlToMarkdown(contentHtml) };
    } catch (e) {
      if (attempt === retries) return { id, title: '', author: '', created: '', updated: '', content: `Falha ao baixar artigo (${e.message})` };
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function slugName(name) {
  return decodeEntities(name).replace(/Categoria raiz\s*>\s*/, '').replace(/[\\:*?"|<]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'aps-assistance.db');
  setDbPath(dbPath);
  const db = getDb();
  db.pragma('foreign_keys = ON');

  console.log('=== GLPI Knowledge Base Importer (full) ===\n');
  console.log('Logging in...');
  await login();
  console.log('Logged in OK\n');

  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  console.log(`List: ${list.length} articles\n`);

  const doneFile = path.join(__dirname, '.glpi-progress.json');
  const done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : [];

  const toFetch = list.filter(it => !done.includes(it.id));
  console.log(`${toFetch.length} to fetch (${done.length} done)`);

  const fetchAll = async (items, label) => {
    let i = 0;
    for (const it of items) {
      i++;
      const a = await fetchArticle(it.id);
      it.title = a.title; it.author = a.author; it.created = a.created; it.updated = a.updated; it.content = a.content;
      done.push(it.id);
      if (i % 25 === 0 || i === items.length) {
        fs.writeFileSync(doneFile, JSON.stringify(done));
        console.log(`  ${label} progress ${i}/${items.length}`);
      }
      process.stdout.write(`[${it.id}] ${(a.title || '??').slice(0, 60)}\n`);
    }
  };

  await fetchAll(toFetch, 'fetch');

  fs.writeFileSync(doneFile, JSON.stringify(done));
  console.log(`\nFetch complete. Total: ${list.length}`);

  console.log('\n--- Importing into SQLite ---');
  const insertFolder = db.prepare('INSERT OR IGNORE INTO folders(name) VALUES(?)');
  const getFolder = db.prepare('SELECT id FROM folders WHERE name = ?');
  const insertFile = db.prepare('INSERT INTO files(folder_id, name, content) VALUES(?, ?, ?)');
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insertFileTag = db.prepare('INSERT OR IGNORE INTO file_tags(file_id, tag_id) VALUES(?, ?)');

  let imported = 0, skipped = 0;
  for (const it of list) {
    const catPath = it.cat && it.cat.fullPath ? it.cat.fullPath : (it.fullPath || 'Categoria raiz');
    const folderName = slugName(catPath) || 'Categoria raiz';
    insertFolder.run(folderName);
    const folder = getFolder.get(folderName);
    const title = it.title || 'Artigo ' + it.id;
    const content = [
      `# ${title}`,
      '',
      it.content || '',
      '',
      '---',
      it.author ? `**Autor:** ${it.author}` : '',
      it.created ? `**Criado em:** ${it.created}` : '',
      it.updated ? `**Última atualização:** ${it.updated}` : '',
      `**Fonte:** Base de Conhecimento GLPI (artigo #${it.id})`,
      '',
      '## Tags',
      '- glpi',
      '- base de conhecimento',
      folderName !== 'Categoria raiz' && folderName !== 'Sem Categoria' ? `- ${slugName(catPath.split('>').pop())}` : ''
    ].filter(line => line !== undefined && line !== '' && line !== '---').join('\n');

    try {
      const info = insertFile.run(folder.id, title, content);
      imported++;
      const tagWords = folderName.split(/[>\s/]+/).filter(w => w.length > 2 && /^[A-Za-zÀ-ú0-9-]+$/.test(w));
      for (const w of tagWords.slice(0, 3)) {
        insertTag.run(w.toLowerCase());
        const tag = getTag.get(w.toLowerCase());
        if (tag) insertFileTag.run(info.lastInsertRowid, tag.id);
      }
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') { skipped++; console.log(`  ! skip (já existe): ${title}`); }
      else throw e;
    }
  }

  console.log(`\n=== Done! ${imported} imported, ${skipped} skipped ===`);
  console.log(`DB: ${dbPath}`);
  closeDb();
}

main();