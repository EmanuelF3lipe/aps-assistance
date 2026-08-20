import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb, setDbPath, closeDb } from './server/database.js';
import { formatContent } from './format-glpi-2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://atendimento.apsinformatica.com.br';
const GLPI_USER = 'EMANUEL_APS';
const GLPI_PASS = '1q2w3e!Q@W#E';
const LIST_FILE = process.env.LIST_FILE || 'C:/Users/APS/AppData/Local/Temp/opencode/glpi-all-items.json';
const PROGRESS_FILE = path.join(__dirname, '.glpi-images-progress.json');
const IMG_DIR = 'C:/Projeto/Aps assistant/notion/_images/glpi';

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
  await new Promise(r => setTimeout(r, 250));
  return res;
}

function decodeEntities(s) {
  if (!s) return '';
  const map = { '&nbsp;': ' ', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú', '&ccedil;': 'ç', '&atilde;': 'ã', '&otilde;': 'õ', '&circ;': '^', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  return s.replace(/&[a-z]+;/gi, m => map[m.toLowerCase()] || m).replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#[xX]([0-9a-fA-F]+);/g, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
}

const EXT_BY_TYPE = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp', 'image/x-icon': '.ico',
  'application/pdf': '.pdf'
};

async function downloadImage(docid, rawSrc) {
  const url = new URL(rawSrc, BASE).toString();
  const res = await get(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || '').split(';')[0].toLowerCase();
  let ext = EXT_BY_TYPE[ct];
  if (!ext) {
    // sniff magic bytes
    if (buf[0] === 0x89 && buf[1] === 0x50) ext = '.png';
    else if (buf[0] === 0xff && buf[1] === 0xd8) ext = '.jpg';
    else if (buf[0] === 0x47 && buf[1] === 0x49) ext = '.gif';
    else ext = '.bin';
  }
  const fname = `glpi-${docid}${ext}`;
  const fp = path.join(IMG_DIR, fname);
  if (!fs.existsSync(fp) || fs.statSync(fp).size === 0) fs.writeFileSync(fp, buf);
  return { fname, ct, bytes: buf.length };
}

async function saveDataImage(uri) {
  const m = uri.match(/^data:(image\/[a-zA-Z0-9+.-]+)?(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1] || 'image/png';
  const b64 = m[3] || '';
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) return null;
  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);
  let ext = EXT_BY_TYPE[mime] || '.png';
  if (!EXT_BY_TYPE[mime]) {
    if (buf[0] === 0x89 && buf[1] === 0x50) ext = '.png';
    else if (buf[0] === 0xff && buf[1] === 0xd8) ext = '.jpg';
    else if (buf[0] === 0x47 && buf[1] === 0x49) ext = '.gif';
  }
  const fname = `glpi-data-${hash}${ext}`;
  const fp = path.join(IMG_DIR, fname);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, buf);
  return fname;
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
  return true;
}

function htmlToMarkdown(html, imgRefs) {
  if (!html) return '';
  let h = html;
  h = h.replace(/<img[^>]*>/gi, (tag) => {
    const src = (tag.match(/src=["']([^"']+)["']/) || [])[1] || '';
    const alt = (tag.match(/alt=["']([^"']*)["']/) || [])[1] || '';
    let rr = null;
    if (src.startsWith('data:')) rr = imgRefs['data:' + src.slice(0, 80)];
    else {
      const docid = (src.match(/docid=(\d+)/) || [])[1];
      if (docid) rr = imgRefs['docid=' + docid];
      else if (/^https?:\/\//.test(src)) rr = imgRefs['http:' + src];
    }
    return rr ? `\n\n![${alt || 'imagem'}](/_images/glpi/${rr})\n\n` : '';
  });
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

async function main() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'aps-assistance.db');
  setDbPath(dbPath);
  const db = getDb();

  console.log('=== GLPI images fetcher ===\n');
  console.log('Logging in...');
  await login();
  console.log('Logged in OK\n');

  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  console.log(`List: ${list.length} articles\n`);

  const done = fs.existsSync(PROGRESS_FILE) ? JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) : [];
  const findFileByArticle = db.prepare("SELECT id FROM files WHERE content LIKE ?");
  const updateFile = db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  let imgCount = 0, updatedFiles = 0, withImgs = 0, failures = [];
  const globalImgRefs = {}; // docid -> filename

  let idx = 0;
  for (const it of list) {
    idx++;
    if (done.includes(it.id)) { process.stdout.write(`-`); continue; }
    try {
      const tabUrl = `${BASE}/ajax/common.tabs.php?_glpi_tab=KnowbaseItem%241&item_itemtype=&item_items_id=&_target=%2Ffront%2Fknowbaseitem.form.php&_itemtype=KnowbaseItem&id=${it.id}`;
      const res = await get(tabUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const txt = await res.text();
      if (txt.includes('Acesso negado') || txt.includes('login') && txt.length < 2000) {
        console.log(`\n[!] ${it.id}: sessão caiu, relogin...`);
        await login();
      }
      const title = (txt.match(/<h2>Assunto<\/h2>\s*([^<]+)/) || [])[1]?.trim() || '';
      const contentHtml = (txt.match(/id='kbanswer'>([\s\S]*?)<\/div>/) || [])[1] || '';
      const author = (txt.match(/Autor:\s*([^<]+)/) || [])[1]?.trim() || '';
      const created = (txt.match(/Criado em\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9:]+)/) || [])[1] || '';
      const updated = (txt.match(/ltima atualiza..o em\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9:]+)/) || [])[1] || '';

      const imgs = [...contentHtml.matchAll(/<img[^>]*>/gi)];
      const imgRefs = {};
      for (const m of imgs) {
        const tag = m[0];
        const src = (tag.match(/src=["']([^"']+)["']/) || [])[1] || '';
        const alt = (tag.match(/alt=["']([^"']*)["']/) || [])[1] || '';
        let fname = null;
        if (src.startsWith('data:')) {
          fname = await saveDataImage(src);
          imgRefs['data:' + src.slice(0, 80)] = fname;
        } else {
          const docid = (src.match(/docid=(\d+)/) || [])[1];
          if (docid) {
            fname = globalImgRefs['docid=' + docid];
            if (!fname) {
              const dl = await downloadImage(docid, src);
              fname = dl.fname;
              globalImgRefs['docid=' + docid] = fname;
            }
            imgRefs['docid=' + docid] = fname;
          } else if (/^https?:\/\//.test(src)) {
            const hkey = 'http:' + src;
            fname = globalImgRefs[hkey];
            if (!fname) {
              try {
                const dl = await downloadImage('ext-' + crypto.createHash('md5').update(src).digest('hex').slice(0, 8), src);
                fname = dl.fname;
                globalImgRefs[hkey] = fname;
              } catch (e) {
                console.log(`\n[!] ${it.id}: externa falhou ${src.slice(0, 60)} (${e.message})`);
                continue;
              }
            }
            imgRefs[hkey] = fname;
          } else {
            console.log(`\n[!] ${it.id}: img ignorada src=${src.slice(0, 60)}`);
            continue;
          }
        }
        imgCount++;
        process.stdout.write(`.`);
      }

      const bodyMd = htmlToMarkdown(contentHtml, imgRefs).trim();
      const catName = it.cat && it.cat.fullPath ? it.cat.fullPath.split('>').pop().trim() : '';
      const content = [
        `# ${decodeEntities(title) || 'Artigo ' + it.id}`,
        '',
        bodyMd || '',
        '',
        '',
        author ? `**Autor:** ${author}` : '',
        created ? `**Criado em:** ${created}` : '',
        updated ? `**Última atualização:** ${updated}` : '',
        `**Fonte:** Base de Conhecimento GLPI (artigo #${it.id})`,
        '',
        '## Tags',
        '- glpi',
        '- base de conhecimento',
        catName ? `- ${decodeEntities(catName)}` : ''
      ].filter(l => l !== undefined && l !== '' && l !== '---').join('\n');

      const formatted = formatContent(content);
      if (imgs.length > 0) {
        const row = findFileByArticle.get(`%artigo #${it.id})%`);
        if (row) {
          updateFile.run(formatted, row.id);
          updatedFiles++;
          withImgs++;
        } else {
          failures.push(`artigo ${it.id} sem file no db`);
        }
      }
    } catch (e) {
      failures.push(`artigo ${it.id}: ${e.message}`);
      console.log(`\n[!] ${it.id} ERRO: ${e.message}`);
    }
    done.push(it.id);
    if (idx % 25 === 0 || idx === list.length) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(done));
      console.log(`\n  progress ${idx}/${list.length} (imgs=${imgCount} files=${updatedFiles})`);
    }
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(done));
  console.log(`\n=== Done! imgs baixadas=${imgCount}, arquivos atualizados=${updatedFiles}, com imagens=${withImgs}`);
  if (failures.length) { console.log('Falhas:'); for (const f of failures) console.log('  -', f); }
  closeDb();
}

main();