import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';
import http from 'http';
import { Server } from 'socket.io';
import { getDb, closeDb } from './database.js';
import { initBot, sendNotification, stopBot } from './telegram-bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTION_PATH = path.join(__dirname, '..', '..', 'notion');
const IMAGES_DIR = path.join(NOTION_PATH, '_images');
const TRASH_FOLDER = '_erros_nao_catalogados';
const SEFAZ_URL = 'https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx';
const CNPJ_CACHE_TTL = 24 * 3600 * 1000;
let LAST_BRASILAPI_AT = 0;
const BRASILAPI_MIN_GAP = 25000;
const NF_UF_CODES = { '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF', '91': 'AN' };

let io;
let httpServer;

function findFolder(name) {
  const db = getDb();
  const normReq = name.normalize('NFC');
  const all = db.prepare('SELECT id, name FROM folders').all();
  return all.find(f => f.name.normalize('NFC') === normReq) || null;
}

function findFile(folderId, name) {
  return getDb().prepare('SELECT id, name, content FROM files WHERE folder_id = ? AND name = ?').get(folderId, name);
}

function stripMd(name) {
  return name && name.endsWith('.md') ? name.slice(0, -3) : name;
}

function loadBotConfig() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM bot_config WHERE key = ?').get('token');
  return { token: row ? row.value : '' };
}

function loadFolderColors() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('folder-colors');
  if (row) {
    try { return JSON.parse(row.value); } catch (e) {}
  }
  const defaults = { scgwin: '#3b82f6', agilis: '#10b981', corpore: '#f59e0b', sgnfe: '#8b5cf6' };
  db.prepare('INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)').run('folder-colors', JSON.stringify(defaults));
  return defaults;
}

function saveFolderColors(colors) {
  getDb().prepare('INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)').run('folder-colors', JSON.stringify(colors));
}

function loadToolboxConfig() {
  const db = getDb();
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('toolbox-config');
  if (row) {
    try { return JSON.parse(row.value); } catch (e) {}
  }
  return {};
}

function saveToolboxConfig(cfg) {
  getDb().prepare('INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)').run('toolbox-config', JSON.stringify(cfg));
}

function getCnpjCache(cnpj) {
  const db = getDb();
  const row = db.prepare('SELECT data, cached_at FROM cnpj_cache WHERE cnpj = ?').get(cnpj);
  if (!row) return null;
  const cachedAt = new Date(row.cached_at + 'Z').getTime();
  return { at: cachedAt, data: JSON.parse(row.data) };
}

function saveCnpjCacheEntry(cnpj, data) {
  getDb().prepare('INSERT OR REPLACE INTO cnpj_cache(cnpj, data, cached_at) VALUES(?, ?, CURRENT_TIMESTAMP)').run(cnpj, JSON.stringify(data));
}

function syncFileTags(fileId, content) {
  const db = getDb();
  db.prepare('DELETE FROM file_tags WHERE file_id = ?').run(fileId);
  const tagMatch = content ? content.match(/## Tags\n([\s\S]*?)$/) : null;
  if (tagMatch) {
    const tagNames = tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).filter(Boolean);
    for (const tagName of tagNames) {
      db.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)').run(tagName);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName);
      if (tag) db.prepare('INSERT INTO file_tags(file_id, tag_id) VALUES(?, ?)').run(fileId, tag.id);
    }
  }
}

async function fetchWithCookies(url, maxRedirects = 5, signal) {
  let cookies = '';
  let currentUrl = url;
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: cookies
      }
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const c of setCookies) {
      const name = c.split(';')[0];
      const key = name.split('=')[0];
      if (key && !cookies.split(';').some(p => p.trim().startsWith(key + '='))) {
        cookies += (cookies ? '; ' : '') + name;
      }
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error('Muitos redirecionamentos');
}

function parseSefaAvailability(html) {
  const checkedMatch = html.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  const rows = [];
  const rowRe = /<tr class="linha(?:Impar|Par)Centralizada">([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => c[1]);
    if (cells.length < 9) continue;
    const uf = cells[0].replace(/<[^>]+>/g, '').trim();
    const statusOf = (cell) => {
      if (/bola_verde/.test(cell)) return 'verde';
      if (/bola_amarela/.test(cell)) return 'amarelo';
      if (/bola_vermelho/.test(cell)) return 'vermelho';
      return null;
    };
    rows.push({
      uf,
      autorizacao: statusOf(cells[1]),
      retorno: statusOf(cells[2]),
      inutilizacao: statusOf(cells[3]),
      consultaProtocolo: statusOf(cells[4]),
      statusServico: statusOf(cells[5]),
      tempoMedio: cells[6].replace(/<[^>]+>/g, '').trim() || null,
      consultaCadastro: statusOf(cells[7]),
      recepcaoEvento: statusOf(cells[8])
    });
  }
  const svcan = (html.match(/lblUsuariosSVCAN">([\s\S]*?)<\/span/) || [])[1];
  const svcrs = (html.match(/lblUsuariosSVCRS">([\s\S]*?)<\/span/) || [])[1];
  return {
    checkedAt: checkedMatch ? checkedMatch[1] : null,
    rows,
    contingencia: {
      svcan: svcan ? svcan.trim() : '',
      svcrs: svcrs ? svcrs.trim() : ''
    }
  };
}

async function fetchBrasilApi(cnpj) {
  if (Date.now() - LAST_BRASILAPI_AT < BRASILAPI_MIN_GAP) return null;
  LAST_BRASILAPI_AT = Date.now();
  try {
    const br = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj, {
      headers: { 'User-Agent': 'APS-Assistance/2.0' }
    });
    if (!br.ok) return null;
    return await br.json();
  } catch (e) {
    return null;
  }
}

export function createServer(port = 3000) {
  const app = express();
  httpServer = http.createServer(app);
  io = new Server(httpServer, { cors: { origin: '*' } });

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  app.get('/cadastrar', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'cadastrar.html'));
  });

  app.get('/api/folders', (req, res) => {
    const db = getDb();
    const folders = db.prepare('SELECT id, name FROM folders').all();
    res.json(folders.map(f => ({ name: f.name, path: f.name })));
  });

  app.post('/api/folders', (req, res) => {
    const { name } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM folders WHERE name = ?').get(name);
    if (existing) {
      return res.status(400).json({ error: 'Pasta já existe' });
    }
    db.prepare('INSERT INTO folders(name) VALUES(?)').run(name);
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.put('/api/folders/:oldName', (req, res) => {
    const { oldName } = req.params;
    const { newName } = req.body;
    const db = getDb();
    const folder = findFolder(oldName);
    if (!folder) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }
    const existing = db.prepare('SELECT id FROM folders WHERE name = ? AND id != ?').get(newName, folder.id);
    if (existing) {
      return res.status(400).json({ error: 'Já existe uma pasta com esse nome' });
    }
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(newName, folder.id);
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.delete('/api/folders/:name', (req, res) => {
    const db = getDb();
    const folder = findFolder(req.params.name);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });

    const files = db.prepare('SELECT id, name, content FROM files WHERE folder_id = ?').all(folder.id);
    const insertTrash = db.prepare('INSERT INTO trash(original_folder, original_name, content) VALUES(?, ?, ?)');
    for (const file of files) {
      insertTrash.run(folder.name, file.name, file.content);
    }

    db.prepare('DELETE FROM folders WHERE id = ?').run(folder.id);
    io.emit('data-changed');
    res.json({ success: true, movedFiles: files.length });
  });

  app.get('/api/files/:folder', (req, res) => {
    const folder = findFolder(req.params.folder);
    if (!folder) return res.json([]);
    const db = getDb();
    const files = db.prepare('SELECT id, name FROM files WHERE folder_id = ?').all(folder.id);
    res.json(files.map(f => ({ name: f.name, filename: f.name + '.md', folder: folder.name })));
  });

  app.get('/api/file/:folder/:filename', (req, res) => {
    const folder = findFolder(req.params.folder);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });
    const nameWithoutExt = stripMd(req.params.filename);
    const file = findFile(folder.id, nameWithoutExt);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    res.json({ content: file.content, filename: req.params.filename, folder: folder.name });
  });

  app.post('/api/file/:folder', (req, res) => {
    const db = getDb();
    let folder = findFolder(req.params.folder);
    if (!folder) {
      db.prepare('INSERT INTO folders(name) VALUES(?)').run(req.params.folder);
      folder = findFolder(req.params.folder);
    }
    const { filename: rawFilename, content } = req.body;
    const nameWithoutExt = stripMd(rawFilename || '');
    db.prepare('INSERT INTO files(folder_id, name, content) VALUES(?, ?, ?)').run(folder.id, nameWithoutExt, content || '');
    const file = findFile(folder.id, nameWithoutExt);
    if (file) syncFileTags(file.id, content || '');
    io.emit('data-changed');
    sendNotification(`📝 *Novo erro criado:*\n${nameWithoutExt} (${req.params.folder})`);
    res.json({ success: true, filename: nameWithoutExt });
  });

  app.put('/api/file/:folder/:filename', (req, res) => {
    const db = getDb();
    const folder = findFolder(req.params.folder);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });
    const nameWithoutExt = stripMd(req.params.filename);
    const file = findFile(folder.id, nameWithoutExt);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.content, file.id);
    syncFileTags(file.id, req.body.content);
    io.emit('data-changed');
    sendNotification(`✏️ *Erro atualizado:*\n${nameWithoutExt} (${folder.name})`);
    res.json({ success: true });
  });

  app.delete('/api/file/:folder/:filename', (req, res) => {
    const db = getDb();
    const folder = findFolder(req.params.folder);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });
    const nameWithoutExt = stripMd(req.params.filename);
    const file = findFile(folder.id, nameWithoutExt);

    if (file) {
      db.prepare('INSERT INTO trash(original_folder, original_name, content) VALUES(?, ?, ?)').run(folder.name, file.name, file.content);
      db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
    }

    io.emit('data-changed');
    sendNotification(`🗑️ *Erro excluido:*\n${nameWithoutExt} (${folder.name})`);
    res.json({ success: true });
  });

  app.put('/api/file/:folder/:filename/tags', (req, res) => {
    const db = getDb();
    const folder = findFolder(req.params.folder);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });
    const nameWithoutExt = stripMd(req.params.filename);
    const file = findFile(folder.id, nameWithoutExt);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    let content = file.content || '';
    content = content.replace(/\n## Tags\n[\s\S]*?(?=\n## |\n# |\nÚltima|$)/, '');

    if (req.body.tags && req.body.tags.length > 0) {
      const tagsSection = '\n## Tags\n' + req.body.tags.map(t => `- ${t}`).join('\n');
      content += tagsSection;
    }

    db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, file.id);
    syncFileTags(file.id, content);
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.put('/api/file/:folder/:filename/rename', (req, res) => {
    const db = getDb();
    const folder = findFolder(req.params.folder);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });
    let { newFilename } = req.body;
    if (!newFilename) return res.status(400).json({ error: 'Nome obrigatorio' });
    const newWithoutExt = stripMd(newFilename);
    const oldWithoutExt = stripMd(req.params.filename);
    const file = findFile(folder.id, oldWithoutExt);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    const existing = findFile(folder.id, newWithoutExt);
    if (existing && existing.id !== file.id) {
      return res.status(400).json({ error: 'Já existe um arquivo com esse nome' });
    }
    db.prepare('UPDATE files SET name = ? WHERE id = ?').run(newWithoutExt, file.id);
    io.emit('data-changed');
    sendNotification(`📝 *Erro renomeado:*\n${oldWithoutExt} → ${newWithoutExt} (${folder.name})`);
    res.json({ success: true, newFilename: newWithoutExt + '.md' });
  });

  app.put('/api/file/:folder/:filename/move', (req, res) => {
    const db = getDb();
    const sourceFolder = findFolder(req.params.folder);
    if (!sourceFolder) return res.status(404).json({ error: 'Pasta não encontrada' });
    const targetFolder = findFolder(req.body.targetFolder);
    if (!targetFolder) {
      return res.status(404).json({ error: 'Pasta destino não encontrada' });
    }
    const nameWithoutExt = stripMd(req.params.filename);
    const file = findFile(sourceFolder.id, nameWithoutExt);
    if (!file) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    const existing = findFile(targetFolder.id, nameWithoutExt);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um arquivo com esse nome na pasta destino' });
    }
    db.prepare('UPDATE files SET folder_id = ? WHERE id = ?').run(targetFolder.id, file.id);
    io.emit('data-changed');
    sendNotification(`📦 *Erro movido:*\n${nameWithoutExt}\n${sourceFolder.name} → ${targetFolder.name}`);
    res.json({ success: true });
  });

  app.get('/api/search', (req, res) => {
    const query = req.query.q.toLowerCase();
    const db = getDb();
    const rows = db.prepare(`
      SELECT f.name, f.content, fo.name as folder
      FROM files f
      JOIN folders fo ON f.folder_id = fo.id
    `).all();
    const results = [];
    for (const row of rows) {
      if (row.content && (row.content.toLowerCase().includes(query) || row.name.toLowerCase().includes(query))) {
        const tagMatch = row.content.match(/## Tags\n([\s\S]*?)$/);
        const tags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];
        results.push({ name: row.name, filename: row.name + '.md', folder: row.folder, excerpt: row.content.substring(0, 150), tags });
      }
    }
    res.json(results);
  });

  app.get('/api/search/advanced', (req, res) => {
    const { q, folder, tags, dateFrom, dateTo } = req.query;
    const query = q ? q.toLowerCase() : '';
    const db = getDb();
    let sql = 'SELECT f.name, f.content, fo.name as folder FROM files f JOIN folders fo ON f.folder_id = fo.id';
    const params = [];
    if (folder) {
      sql += ' WHERE fo.name = ?';
      params.push(folder);
    }
    const rows = db.prepare(sql).all(...params);
    const results = [];

    for (const row of rows) {
      if (query && !(row.content && row.content.toLowerCase().includes(query)) && !row.name.toLowerCase().includes(query)) continue;

      if (tags) {
        const tagMatch = row.content ? row.content.match(/## Tags\n([\s\S]*?)$/) : null;
        const fileTags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];
        const searchTags = tags.split(',').map(t => t.trim().toLowerCase());
        if (!searchTags.some(st => fileTags.some(ft => ft.toLowerCase().includes(st)))) continue;
      }

      if (dateFrom || dateTo) {
        const dateMatch = row.content ? row.content.match(/\*\*Criado em:\*\*\s*(\d{2}\/\d{2}\/\d{4})/) : null;
        if (dateMatch) {
          const [, dateStr] = dateMatch;
          const [day, month, year] = dateStr.split('/');
          const fileDate = new Date(year, month - 1, day);
          if (dateFrom) {
            const [fy, fm, fd] = dateFrom.split('-');
            if (fileDate < new Date(fy, fm - 1, fd)) continue;
          }
          if (dateTo) {
            const [ty, tm, td] = dateTo.split('-');
            if (fileDate > new Date(ty, tm - 1, td)) continue;
          }
        }
      }

      const tagMatch = row.content ? row.content.match(/## Tags\n([\s\S]*?)$/) : null;
      const fileTags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];
      results.push({
        name: row.name,
        filename: row.name + '.md',
        folder: row.folder,
        excerpt: row.content ? row.content.substring(0, 150) : '',
        tags: fileTags
      });
    }

    res.json(results);
  });

  app.get('/api/stats', (req, res) => {
    const db = getDb();
    const stats = { total: 0, byFolder: {}, recentFiles: [], tags: {} };
    const folders = db.prepare('SELECT id, name FROM folders').all();
    for (const fo of folders) {
      const files = db.prepare('SELECT id, name, content, updated_at FROM files WHERE folder_id = ?').all(fo.id);
      stats.byFolder[fo.name] = files.length;
      stats.total += files.length;
      for (const file of files) {
        stats.recentFiles.push({ name: file.name, filename: file.name + '.md', folder: fo.name, modified: file.updated_at });
        if (file.content) {
          const tagMatch = file.content.match(/## Tags\n([\s\S]*?)$/);
          if (tagMatch) {
            tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).forEach(tag => {
              stats.tags[tag] = (stats.tags[tag] || 0) + 1;
            });
          }
        }
      }
    }
    stats.recentFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    stats.recentFiles = stats.recentFiles.slice(0, 10);
    res.json(stats);
  });

  app.get('/api/favorites', (req, res) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT f.name as filename, fo.name as folder, fav.added_at as added
      FROM favorites fav
      JOIN files f ON fav.file_id = f.id
      JOIN folders fo ON f.folder_id = fo.id
    `).all();
    res.json(rows.map(r => ({ filename: r.filename + '.md', folder: r.folder, added: r.added })));
  });

  app.post('/api/favorites', (req, res) => {
    const { filename, folder: folderName } = req.body;
    const db = getDb();
    const folder = findFolder(folderName);
    if (!folder) return res.status(404).json({ error: 'Pasta não encontrada' });
    const nameWithoutExt = stripMd(filename);
    const file = findFile(folder.id, nameWithoutExt);
    if (!file) return res.status(404).json({ error: 'Arquivo não encontrado' });
    db.prepare('INSERT OR IGNORE INTO favorites(file_id) VALUES(?)').run(file.id);
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.delete('/api/favorites/:folder/:filename', (req, res) => {
    const db = getDb();
    const folder = findFolder(req.params.folder);
    if (folder) {
      const nameWithoutExt = stripMd(req.params.filename);
      const file = findFile(folder.id, nameWithoutExt);
      if (file) {
        db.prepare('DELETE FROM favorites WHERE file_id = ?').run(file.id);
      }
    }
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.get('/api/tags', (req, res) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT t.name as tag, f.name as filename, fo.name as folder
      FROM file_tags ft
      JOIN tags t ON ft.tag_id = t.id
      JOIN files f ON ft.file_id = f.id
      JOIN folders fo ON f.folder_id = fo.id
    `).all();
    const tags = {};
    for (const row of rows) {
      if (!tags[row.tag]) tags[row.tag] = [];
      tags[row.tag].push({ filename: row.filename + '.md', folder: row.folder });
    }
    res.json(tags);
  });

  app.get('/api/trash', (req, res) => {
    const db = getDb();
    const entries = db.prepare('SELECT * FROM trash ORDER BY deleted_at DESC').all();
    res.json(entries.map(e => ({
      id: e.id,
      name: e.original_name,
      filename: e.original_folder + '__' + e.original_name + '.md',
      folder: TRASH_FOLDER,
      originalFolder: e.original_folder
    })));
  });

  app.put('/api/trash/restore/:filename', (req, res) => {
    const db = getDb();
    const encodedFilename = req.params.filename;
    const entries = db.prepare('SELECT * FROM trash').all();
    const trashEntry = entries.find(e => {
      const composed = e.original_folder + '__' + e.original_name + '.md';
      return encodeURIComponent(composed) === encodedFilename || composed === encodedFilename;
    });
    if (!trashEntry) return res.status(404).json({ error: 'Arquivo não encontrado' });

    let folder = findFolder(trashEntry.original_folder);
    if (!folder) {
      db.prepare('INSERT INTO folders(name) VALUES(?)').run(trashEntry.original_folder);
      folder = findFolder(trashEntry.original_folder);
    }

    db.prepare('INSERT INTO files(folder_id, name, content) VALUES(?, ?, ?)').run(folder.id, trashEntry.original_name, trashEntry.content);
    const file = findFile(folder.id, trashEntry.original_name);
    if (file) syncFileTags(file.id, trashEntry.content || '');
    db.prepare('DELETE FROM trash WHERE id = ?').run(trashEntry.id);

    io.emit('data-changed');
    res.json({ success: true });
  });

  app.delete('/api/trash/:filename', (req, res) => {
    const db = getDb();
    const encodedFilename = req.params.filename;
    const entries = db.prepare('SELECT * FROM trash').all();
    const trashEntry = entries.find(e => {
      const composed = e.original_folder + '__' + e.original_name + '.md';
      return encodeURIComponent(composed) === encodedFilename || composed === encodedFilename;
    });
    if (trashEntry) {
      db.prepare('DELETE FROM trash WHERE id = ?').run(trashEntry.id);
    }
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.delete('/api/trash', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM trash').run();
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.get('/api/folder-colors', (req, res) => {
    res.json(loadFolderColors());
  });

  app.put('/api/folder-colors/:folder', (req, res) => {
    const { folder } = req.params;
    const { color } = req.body;
    if (!color) return res.status(400).json({ error: 'Cor obrigatoria' });
    const colors = loadFolderColors();
    colors[folder] = color;
    saveFolderColors(colors);
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.delete('/api/folder-colors/:folder', (req, res) => {
    const { folder } = req.params;
    const colors = loadFolderColors();
    delete colors[folder];
    saveFolderColors(colors);
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.get('/api/reports', (req, res) => {
    const db = getDb();
    const reports = db.prepare('SELECT id, title, category, content FROM reports').all();
    res.json(reports);
  });

  app.post('/api/reports', (req, res) => {
    const { title, category, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Titulo obrigatorio' });
    const db = getDb();
    const result = db.prepare('INSERT INTO reports(title, category, content) VALUES(?, ?, ?)').run(title, category || 'geral', content || '');
    const report = db.prepare('SELECT id, title, category, content FROM reports WHERE id = ?').get(result.lastInsertRowid);
    io.emit('data-changed');
    res.json(report);
  });

  app.put('/api/reports/:id', (req, res) => {
    const { id } = req.params;
    const { title, category, content } = req.body;
    const db = getDb();
    const report = db.prepare('SELECT id, title, category, content FROM reports WHERE id = ?').get(Number(id));
    if (!report) return res.status(404).json({ error: 'Relatorio nao encontrado' });
    if (title !== undefined) report.title = title;
    if (category !== undefined) report.category = category;
    if (content !== undefined) report.content = content;
    db.prepare('UPDATE reports SET title = ?, category = ?, content = ? WHERE id = ?').run(report.title, report.category, report.content, Number(id));
    io.emit('data-changed');
    res.json(report);
  });

  app.delete('/api/reports/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM reports WHERE id = ?').run(Number(req.params.id));
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.get('/api/diary', (req, res) => {
    const { date, search } = req.query;
    const db = getDb();
    let sql = 'SELECT id, title, content, category, priority, author, shift, date, resolved, created_at as createdAt, resolved_at as resolvedAt, updated_at as updatedAt FROM diary';
    const conditions = [];
    const params = [];
    if (date) {
      conditions.push('date = ?');
      params.push(date);
    }
    if (search) {
      conditions.push('(LOWER(content) LIKE ? OR LOWER(title) LIKE ? OR LOWER(author) LIKE ?)');
      const q = '%' + search.toLowerCase() + '%';
      params.push(q, q, q);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const entries = db.prepare(sql).all(...params);
    res.json(entries);
  });

  app.post('/api/diary', (req, res) => {
    const { title, content, category, priority, author, shift } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Titulo e conteudo obrigatorios' });
    const db = getDb();
    const now = new Date().toISOString();
    const date = new Date().toLocaleDateString('pt-BR');
    const result = db.prepare(`
      INSERT INTO diary(title, content, category, priority, author, shift, date, resolved, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(title, content, category || 'ocorrencia', priority || 'normal', author || 'Anonimo', shift || '', date, now);
    const entry = db.prepare(`
      SELECT id, title, content, category, priority, author, shift, date, resolved, created_at as createdAt, resolved_at as resolvedAt, updated_at as updatedAt
      FROM diary WHERE id = ?
    `).get(result.lastInsertRowid);
    io.emit('data-changed');
    res.json(entry);
  });

  app.put('/api/diary/:id', (req, res) => {
    const { id } = req.params;
    const { resolved, content, priority } = req.body;
    const db = getDb();
    const entry = db.prepare('SELECT * FROM diary WHERE id = ?').get(Number(id));
    if (!entry) return res.status(404).json({ error: 'Entrada nao encontrada' });

    let newResolved = entry.resolved;
    let resolvedAt = entry.resolved_at;
    let newContent = entry.content;
    let newPriority = entry.priority;
    const now = new Date().toISOString();

    if (resolved !== undefined) {
      newResolved = resolved ? 1 : 0;
      resolvedAt = resolved ? now : null;
    }
    if (content !== undefined) newContent = content;
    if (priority !== undefined) newPriority = priority;

    db.prepare('UPDATE diary SET resolved = ?, resolved_at = ?, content = ?, priority = ?, updated_at = ? WHERE id = ?')
      .run(newResolved, resolvedAt, newContent, newPriority, now, Number(id));

    const updated = db.prepare(`
      SELECT id, title, content, category, priority, author, shift, date, resolved, created_at as createdAt, resolved_at as resolvedAt, updated_at as updatedAt
      FROM diary WHERE id = ?
    `).get(Number(id));
    io.emit('data-changed');
    res.json(updated);
  });

  app.delete('/api/diary/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM diary WHERE id = ?').run(Number(req.params.id));
    io.emit('data-changed');
    res.json({ success: true });
  });

  app.get('/api/toolbox/codes', (req, res) => {
    const db = getDb();
    const codes = db.prepare('SELECT id, codigo, descricao FROM toolbox_codes').all();
    res.json(codes);
  });

  app.post('/api/toolbox/codes', (req, res) => {
    const { codigo, descricao } = req.body;
    if (!codigo || !descricao) return res.status(400).json({ error: 'Codigo e descricao obrigatorios' });
    const db = getDb();
    const result = db.prepare('INSERT INTO toolbox_codes(codigo, descricao) VALUES(?, ?)').run(String(codigo), String(descricao));
    const item = db.prepare('SELECT id, codigo, descricao FROM toolbox_codes WHERE id = ?').get(result.lastInsertRowid);
    res.json(item);
  });

  app.put('/api/toolbox/codes/:id', (req, res) => {
    const { id } = req.params;
    const db = getDb();
    const item = db.prepare('SELECT id, codigo, descricao FROM toolbox_codes WHERE id = ?').get(Number(id));
    if (!item) return res.status(404).json({ error: 'Codigo nao encontrado' });
    if (req.body.codigo !== undefined) item.codigo = String(req.body.codigo);
    if (req.body.descricao !== undefined) item.descricao = String(req.body.descricao);
    db.prepare('UPDATE toolbox_codes SET codigo = ?, descricao = ? WHERE id = ?').run(item.codigo, item.descricao, Number(id));
    res.json(item);
  });

  app.delete('/api/toolbox/codes/:id', (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM toolbox_codes WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/toolbox/sefa-status', async (req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchWithCookies(SEFAZ_URL, 5, controller.signal);
      clearTimeout(timer);
      if (!response.ok) {
        return res.json({ ok: false, error: 'Portal respondeu HTTP ' + response.status });
      }
      const html = await response.text();
      const parsed = parseSefaAvailability(html);
      if (!parsed.rows.length) {
        return res.json({ ok: false, error: 'Nao foi possivel interpretar a pagina de disponibilidade' });
      }
      res.json({ ok: true, ...parsed });
    } catch (e) {
      clearTimeout(timer);
      res.json({ ok: false, error: e.name === 'AbortError' ? 'Tempo esgotado (15s)' : e.message });
    }
  });

  app.get('/api/toolbox/config', (req, res) => {
    res.json({ sintegraConfigured: !!loadToolboxConfig().sintegraApiKey });
  });

  app.put('/api/toolbox/config', (req, res) => {
    const { sintegraApiKey } = req.body || {};
    const cfg = loadToolboxConfig();
    if (sintegraApiKey !== undefined) {
      cfg.sintegraApiKey = String(sintegraApiKey).trim();
    }
    saveToolboxConfig(cfg);
    res.json({ ok: true, sintegraConfigured: !!cfg.sintegraApiKey });
  });

  app.get('/api/toolbox/cnpj/:cnpj', async (req, res) => {
    const cnpj = (req.params.cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const forceRefresh = req.query.refresh === '1';
    if (cnpj.length !== 14) return res.json({ ok: false, error: 'CNPJ deve ter 14 digitos' });

    if (!forceRefresh) {
      const cached = getCnpjCache(cnpj);
      if (cached && Date.now() - cached.at < CNPJ_CACHE_TTL) {
        return res.json({ ok: true, source: 'cache', data: cached.data });
      }
    }

    try {
      const rw = await fetch('https://www.receitaws.com.br/v1/cnpj/' + cnpj);
      if (rw.ok) {
        const j = await rw.json();
        if (j.status === 'ERROR') return res.json({ ok: false, error: j.message || 'Nao foi possivel consultar o CNPJ' });
        const data = {
          cnpj: j.cnpj,
          razaoSocial: j.nome,
          fantasia: j.fantasia,
          situacao: j.situacao,
          dataSituacao: j.data_situacao,
          dataAbertura: j.abertura,
          ie: null,
          ieFonte: null,
          inscricoes: [],
          im: null,
          porte: j.porte,
          capitalSocial: j.capital_social,
          naturezaJuridica: j.natureza_juridica,
          atividadePrincipal: j.atividade_principal && j.atividade_principal[0] ? j.atividade_principal[0].texto : null,
          cnaePrincipal: j.atividade_principal && j.atividade_principal[0] ? j.atividade_principal[0].code : null,
          cnaesSecundarios: (j.atividades_secundarias || []).map(a => a.code + ' - ' + a.texto).slice(0, 10),
          endereco: ((j.logradouro || '') + ', ' + (j.numero || '') + (j.complemento ? ', ' + j.complemento : '') + ' - ' + (j.bairro || '') + ', ' + (j.municipio || '') + '/' + (j.uf || '') + ' - CEP ' + (j.cep || '')).replace(/^, /, ''),
          telefone: j.telefone || null,
          email: j.email || null,
          socios: (j.qsa || []).slice(0, 8).map(s => s.nome + (s.qual ? ' (' + s.qual + ')' : ''))
        };
        let ieFromSintegra = false;
        const cfg = loadToolboxConfig();
        if (cfg.sintegraApiKey) {
          try {
            const st = await fetch('https://www.sintegrabrasil.com.br/api/v1/cnpj/' + cnpj, {
              headers: { 'X-Api-Key': cfg.sintegraApiKey }
            });
            if (st.ok) {
              const sj = await st.json();
              if (Array.isArray(sj.inscricoes_estaduais) && sj.inscricoes_estaduais.length) {
                data.inscricoes = sj.inscricoes_estaduais.map(ie => ({
                  ie: ie.inscricao_estadual,
                  ativa: !!ie.ativo,
                  uf: ie.uf || null,
                  atualizadoEm: ie.atualizado_em || null
                }));
                data.ie = data.inscricoes[0].ie;
                data.ieFonte = 'sintegra';
                ieFromSintegra = true;
              }
            }
          } catch (e) {}
        }
        if (!ieFromSintegra) {
          const bj = await fetchBrasilApi(cnpj);
          if (bj) {
            const be = bj.estabelecimento || {};
            if (be.inscricao_estadual) { data.ie = be.inscricao_estadual; data.ieFonte = 'brasilapi'; }
            if (be.inscricao_municipal) data.im = be.inscricao_municipal;
            if (!data.cnpj) data.cnpj = bj.cnpj;
          }
        }
        saveCnpjCacheEntry(cnpj, data);
        return res.json({ ok: true, source: 'receitaws' + (data.ie ? '+brasilapi' : ''), data });
      }
      const bj = await fetchBrasilApi(cnpj);
      if (bj) {
        const e = bj.estabelecimento || {};
        const data = {
          cnpj: bj.cnpj,
          razaoSocial: bj.razao_social,
          fantasia: bj.nome_fantasia,
          situacao: bj.descricao_situacao_cadastral,
          dataSituacao: bj.data_situacao_cadastral,
          dataAbertura: bj.data_inicio_atividade,
          ie: e.inscricao_estadual || null,
          ieFonte: e.inscricao_estadual ? 'brasilapi' : null,
          inscricoes: [],
          im: e.inscricao_municipal || null,
          porte: bj.descricao_porte || (bj.porte && bj.porte.descricao) || null,
          capitalSocial: bj.capital_social,
          naturezaJuridica: bj.natureza_juridica,
          atividadePrincipal: (e.atividade_principal && e.atividade_principal.descricao) || null,
          cnaePrincipal: (e.atividade_principal && e.atividade_principal.code) || null,
          cnaesSecundarios: (e.atividades_secundarias || []).map(a => a.code + ' - ' + a.descricao).slice(0, 10),
          endereco: ((e.tipo_logradouro || '') + ' ' + (e.logradouro || '')).trim() + (e.numero ? ', ' + e.numero : '') + (e.complemento ? ', ' + e.complemento : '') + ' - ' + (e.bairro || '') + ', ' + ((e.municipio && e.municipio.descricao) || '') + '/' + ((e.estado && e.estado.sigla) || '') + ' - CEP ' + (e.cep || ''),
          telefone: (e.ddd1 || e.telefone1) ? '(' + (e.ddd1 || '') + ') ' + (e.telefone1 || '') : null,
          email: e.email || null,
          socios: (bj.socios || []).slice(0, 8).map(s => s.nome_socio + (s.qualificacao_socio && s.qualificacao_socio.descricao ? ' (' + s.qualificacao_socio.descricao + ')' : ''))
        };
        saveCnpjCacheEntry(cnpj, data);
        return res.json({ ok: true, source: 'brasilapi', data });
      }
      return res.json({ ok: false, error: 'Falha ao consultar (HTTP ' + (rw.status || 0) + ') - limite de requisicoes atingido, tente novamente em 1 minuto' });
    } catch (e) {
      return res.json({ ok: false, error: e.message });
    }
  });

  app.get('/api/toolbox/nfe/:chave', (req, res) => {
    const chave = (req.params.chave || '').replace(/\D/g, '');
    if (chave.length !== 44) return res.json({ ok: false, error: 'A chave deve ter 44 digitos' });
    const base = chave.substring(0, 43);
    let sum = 0, w = 2;
    for (let i = base.length - 1; i >= 0; i--) {
      sum += Number(base[i]) * w;
      w = w === 9 ? 2 : w + 1;
    }
    const dv = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    const valida = dv === Number(chave[43]);
    const uf = NF_UF_CODES[chave.substring(0, 2)] || 'Desconhecida';
    const aamm = chave.substring(2, 6);
    res.json({
      ok: true,
      valida,
      chave,
      uf: { codigo: chave.substring(0, 2), sigla: uf },
      dataEmissao: aamm.substring(2, 4) + '/' + '20' + aamm.substring(0, 2),
      cnpjEmitente: chave.substring(6, 20),
      modelo: chave.substring(20, 22),
      serie: chave.substring(22, 25),
      numero: chave.substring(25, 34),
      tipoEmissao: chave.substring(34, 35)
    });
  });

  app.post('/api/attachments/upload', (req, res) => {
    const { folder, filename, fileData, originalName } = req.body;

    if (!fileData || !originalName) {
      return res.status(400).json({ error: 'Dados do arquivo nao fornecidos' });
    }

    const ext = path.extname(originalName) || '.bin';
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const folderDir = path.join(IMAGES_DIR, folder.replace(/\//g, '_'));
    if (!fs.existsSync(folderDir)) {
      fs.mkdirSync(folderDir, { recursive: true });
    }

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const filePath = path.join(folderDir, uniqueName);

    try {
      fs.writeFileSync(filePath, base64Data, 'base64');

      const db = getDb();
      let file_id = null;
      if (filename) {
        const folderRow = findFolder(folder);
        if (folderRow) {
          const fileRow = findFile(folderRow.id, stripMd(filename));
          if (fileRow) {
            file_id = fileRow.id;
            db.prepare('INSERT INTO attachments(file_id, original_name, stored_name) VALUES(?, ?, ?)').run(file_id, originalName, uniqueName);

            let content = fileRow.content || '';
            const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(originalName);
            const attachRef = isImage
              ? `\n![${originalName}](/_images/${folder.replace(/\//g, '_')}/${uniqueName})`
              : `\n[ ${originalName} ](/_images/${folder.replace(/\//g, '_')}/${uniqueName})`;

            if (content.includes('## Anexos')) {
              content = content.replace('## Anexos\n', `## Anexos\n${attachRef}\n`);
            } else {
              content += `\n\n## Anexos\n${attachRef}`;
            }

            db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, fileRow.id);
          }
        }
      }

      res.json({ success: true, attachPath: `/_images/${folder.replace(/\//g, '_')}/${uniqueName}` });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao salvar arquivo' });
    }
  });

  app.get('/api/attachments/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const folderDir = path.join(IMAGES_DIR, folder.replace(/\//g, '_'));

    if (!fs.existsSync(folderDir)) {
      return res.json([]);
    }

    const db = getDb();
    const metaMap = {};
    const folderRow = findFolder(folder);
    if (folderRow) {
      const fileRow = findFile(folderRow.id, stripMd(filename));
      if (fileRow) {
        const attachments = db.prepare('SELECT original_name, stored_name FROM attachments WHERE file_id = ?').all(fileRow.id);
        for (const att of attachments) {
          metaMap[att.stored_name] = att.original_name;
        }
      }
    }

    let referencedFiles = [];
    if (folderRow) {
      const fileRow = findFile(folderRow.id, stripMd(filename));
      if (fileRow && fileRow.content) {
        const attachRegex = /\!\[.*?\]\(\/_images\/([^)]+)\)|\[\s*.*?\]\(\/_images\/([^)]+)\)/g;
        let match;
        while ((match = attachRegex.exec(fileRow.content)) !== null) {
          const ref = match[1] || match[2];
          if (ref) referencedFiles.push(ref);
        }
      }
    }

    const allFiles = fs.readdirSync(folderDir).filter(f => f !== '_metadata.json');
    const attachments = allFiles
      .filter(f => referencedFiles.some(ref => ref.endsWith(f)))
      .map(f => {
        const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(f);
        const originalName = metaMap[f] || f;
        return {
          name: f,
          originalName,
          path: `/_images/${folder.replace(/\//g, '_')}/${f}`,
          url: `/_images/${folder.replace(/\//g, '_')}/${f}`,
          isImage
        };
      });

    res.json(attachments);
  });

  app.delete('/api/attachments/:folder/:fileName', (req, res) => {
    const { folder, fileName } = req.params;
    const filePath = path.join(IMAGES_DIR, folder.replace(/\//g, '_'), fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const db = getDb();
    db.prepare('DELETE FROM attachments WHERE stored_name = ?').run(fileName);

    const folderRow = findFolder(folder);
    if (folderRow) {
      const files = db.prepare('SELECT id, content FROM files WHERE folder_id = ?').all(folderRow.id);
      const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const folderNameEscaped = folder.replace(/\//g, '_');

      for (const file of files) {
        const attachRefRegex = new RegExp(`\\!\\[.*?\\]\\(/_images/${folderNameEscaped}/${escapedFileName}\\)|\\[\\s*.*?\\]\\(/_images/${folderNameEscaped}/${escapedFileName}\\)`, 'g');
        if (attachRefRegex.test(file.content || '')) {
          let content = file.content.replace(attachRefRegex, '');
          content = content.replace(/## Anexos\n\n*/g, '');
          db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, file.id);
          break;
        }
      }
    }

    res.json({ success: true });
  });

  app.use('/_images', express.static(IMAGES_DIR));

  app.get('/api/bot-config', (req, res) => {
    const config = loadBotConfig();
    res.json({ token: config.token ? '***configurado***' : '' });
  });

  app.put('/api/bot-config', (req, res) => {
    const { token } = req.body;
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO bot_config(key, value) VALUES(?, ?)').run('token', token || '');
    if (token) {
      initBot(token);
      res.json({ success: true, message: 'Bot reiniciado com novo token' });
    } else {
      stopBot();
      res.json({ success: true, message: 'Token removido' });
    }
  });

  app.post('/api/bot-stop', (req, res) => {
    stopBot();
    res.json({ success: true, message: 'Bot parado' });
  });

  app.get('/api/public/folders-tags', (req, res) => {
    const db = getDb();
    const folderRows = db.prepare('SELECT name FROM folders').all();
    const folders = folderRows.map(f => f.name);
    const allTags = {};
    for (const folderName of folders) {
      const folderRow = findFolder(folderName);
      if (!folderRow) continue;
      const files = db.prepare('SELECT content FROM files WHERE folder_id = ?').all(folderRow.id);
      for (const file of files) {
        if (!file.content) continue;
        const m = file.content.match(/## Tags\n([\s\S]*?)$/);
        if (m) {
          m[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).filter(Boolean).forEach(tag => {
            allTags[tag] = true;
          });
        }
      }
    }
    res.json({ folders, tags: Object.keys(allTags).sort() });
  });

  app.post('/api/public/submit', (req, res) => {
    const { title: rawTitle, sistema, contexto, resolucao, tags } = req.body;
    const title = (rawTitle || '').trim();
    if (!title || !sistema) {
      return res.status(400).json({ error: 'Titulo e sistema sao obrigatorios' });
    }
    const now = new Date();
    const date = now.toLocaleDateString('pt-BR');
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const tagsMd = (tags || []).map(t => '- ' + t).join('\n') || '- ';
    const content = '# ' + title + '\n\n**Criado em:** ' + date + ' ' + time + '\n**Sistema:** ' + sistema + '\n**Contexto / Quando acontece:** ' + (contexto || '') + '\n\n## Resolucao (passo a passo)\n\n' + (resolucao || '') + '\n\n## Observacao\n\n\n\n## Tags\n\n' + tagsMd + '\n\n---\n';

    const db = getDb();
    let folder = findFolder(sistema);
    if (!folder) {
      db.prepare('INSERT INTO folders(name) VALUES(?)').run(sistema);
      folder = findFolder(sistema);
    }
    db.prepare('INSERT INTO files(folder_id, name, content) VALUES(?, ?, ?)').run(folder.id, title, content);
    const file = findFile(folder.id, title);
    if (file) syncFileTags(file.id, content);

    sendNotification('📝 *Erro cadastrado via formulario:*\n' + title + '\n📂 ' + sistema);
    res.json({ success: true, message: 'Erro cadastrado com sucesso' });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`\n   ╔══════════════════════════════════════╗`);
    console.log(`   ║     APS Assistance - ONLINE          ║`);
    console.log(`   ╚══════════════════════════════════════╝`);
    console.log(`\n   Local:   http://localhost:${port}`);
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`   Rede:    http://${net.address}:${port}`);
        }
      }
    }
    const botConfig = loadBotConfig();
    if (botConfig.token) {
      initBot(botConfig.token);
      console.log(`   Telegram: bot ativo`);
      sendNotification('🟢 *Servidor ONLINE*\nHorario: ' + now);
    } else {
      console.log(`   Telegram: desativado (configure bot-config.json)`);
    }
    console.log(`\n   ╔══════════════════════════════════════╗`);
    console.log(`   ║  [R] Reiniciar Servidor              ║`);
    console.log(`   ║  [Q] Sair                            ║`);
    console.log(`   ╚══════════════════════════════════════╝\n`);
  });

  return { app, httpServer, io };
}

function handleRestart() {
  console.log('\n   Reiniciando servidor...');
  sendNotification('🔄 *Servidor REINICIANDO*');
  setTimeout(() => {
    stopBot();
    closeDb();
    httpServer.close(() => {
      createServer(3000);
    });
  }, 500);
}

function handleQuit() {
  console.log('\n   Encerrando servidor...');
  sendNotification('🔴 *Servidor OFFLINE*');
  setTimeout(() => {
    stopBot();
    closeDb();
    process.exit(0);
  }, 500);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  createServer(3000);

  process.on('SIGINT', () => handleQuit());
  process.on('SIGTERM', () => handleQuit());

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      const k = key.toString().toLowerCase();
      if (k === 'r') handleRestart();
      if (k === 'q' || k === '\u0003') handleQuit();
    });
  }
}
