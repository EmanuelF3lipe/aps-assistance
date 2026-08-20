import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './server/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTION_PATH = path.join(__dirname, '..', 'notion');
const TRASH_FOLDER = '_erros_nao_catalogados';
const IMAGES_FOLDER = '_images';
const BASE = __dirname;

function loadJson(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  } catch (e) { console.warn(`  WARN: failed to parse ${filepath}: ${e.message}`); }
  return null;
}

function migrate() {
  const db = getDb();
  let counts = { folders: 0, files: 0, tags: 0, favorites: 0, diary: 0, reports: 0, toolboxCodes: 0, config: 0, cnpjCache: 0, trash: 0, botConfig: 0 };

  console.log('=== APS Assistance - Migration to SQLite ===\n');

  // 1. Migrate folders and .md files
  console.log('[1/8] Migrating folders and .md files...');
  if (fs.existsSync(NOTION_PATH)) {
    const dirs = fs.readdirSync(NOTION_PATH).filter(f => {
      const fp = path.join(NOTION_PATH, f);
      return fs.statSync(fp).isDirectory() && f !== TRASH_FOLDER && f !== IMAGES_FOLDER;
    });

    const insertFolder = db.prepare('INSERT OR IGNORE INTO folders(name) VALUES(?)');
    const insertFile = db.prepare('INSERT INTO files(folder_id, name, content) VALUES(?, ?, ?)');
    const getFolder = db.prepare('SELECT id FROM folders WHERE name = ?');

    for (const dir of dirs) {
      insertFolder.run(dir);
      const folder = getFolder.get(dir);
      if (!folder) continue;
      counts.folders++;

      const files = fs.readdirSync(path.join(NOTION_PATH, dir)).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(NOTION_PATH, dir, file), 'utf8');
        const name = file.replace('.md', '');
        insertFile.run(folder.id, name, content);
        counts.files++;
      }
    }
  }
  console.log(`  -> ${counts.folders} folders, ${counts.files} files\n`);

  // 2. Sync tags from markdown content
  console.log('[2/8] Syncing tags from markdown content...');
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insertFileTag = db.prepare('INSERT OR IGNORE INTO file_tags(file_id, tag_id) VALUES(?, ?)');
  const allFiles = db.prepare('SELECT id, content FROM files').all();

  for (const file of allFiles) {
    if (!file.content) continue;
    const tagMatch = file.content.match(/## Tags\n([\s\S]*?)$/);
    if (!tagMatch) continue;
    const tagNames = tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).filter(Boolean);
    for (const tagName of tagNames) {
      insertTag.run(tagName);
      const tag = getTag.get(tagName);
      if (tag) {
        insertFileTag.run(file.id, tag.id);
        counts.tags++;
      }
    }
  }
  console.log(`  -> ${counts.tags} tag associations\n`);

  // 3. Migrate trash
  console.log('[3/8] Migrating trash...');
  const trashPath = path.join(NOTION_PATH, TRASH_FOLDER);
  if (fs.existsSync(trashPath)) {
    const insertTrash = db.prepare('INSERT INTO trash(original_folder, original_name, content) VALUES(?, ?, ?)');
    const files = fs.readdirSync(trashPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const parts = file.split('__');
      const originalFolder = parts.length > 1 ? parts[0] : 'desconhecido';
      const originalName = parts.length > 1 ? parts.slice(1).join('__').replace('.md', '') : file.replace('.md', '');
      const content = fs.readFileSync(path.join(trashPath, file), 'utf8');
      insertTrash.run(originalFolder, originalName, content);
      counts.trash++;
    }
  }
  console.log(`  -> ${counts.trash} trash items\n`);

  // 4. Migrate favorites
  console.log('[4/8] Migrating favorites...');
  const favs = loadJson(path.join(BASE, 'favorites.json'));
  if (Array.isArray(favs) && favs.length > 0) {
    const getFolderByName = db.prepare('SELECT id FROM folders WHERE name = ?');
    const getFileByName = db.prepare('SELECT id FROM files WHERE folder_id = ? AND name = ?');
    const insertFav = db.prepare('INSERT OR IGNORE INTO favorites(file_id) VALUES(?)');

    for (const fav of favs) {
      const folder = getFolderByName.get(fav.folder);
      if (!folder) continue;
      const file = getFileByName.get(folder.id, (fav.filename || '').replace('.md', ''));
      if (file) {
        insertFav.run(file.id);
        counts.favorites++;
      }
    }
  }
  console.log(`  -> ${counts.favorites} favorites\n`);

  // 5. Migrate diary
  console.log('[5/8] Migrating diary...');
  const diary = loadJson(path.join(BASE, 'diary.json'));
  if (Array.isArray(diary) && diary.length > 0) {
    const insertDiary = db.prepare(`
      INSERT INTO diary(id, title, content, category, priority, author, shift, date, resolved, created_at, resolved_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of diary) {
      insertDiary.run(
        Number(entry.id) || Date.now(),
        entry.title || '',
        entry.content || '',
        entry.category || 'ocorrencia',
        entry.priority || 'normal',
        entry.author || 'Anonimo',
        entry.shift || '',
        entry.date || '',
        entry.resolved ? 1 : 0,
        entry.createdAt || new Date().toISOString(),
        entry.resolvedAt || null,
        entry.updatedAt || null
      );
      counts.diary++;
    }
  }
  console.log(`  -> ${counts.diary} diary entries\n`);

  // 6. Migrate reports
  console.log('[6/8] Migrating reports...');
  const reports = loadJson(path.join(BASE, 'reports.json'));
  if (Array.isArray(reports) && reports.length > 0) {
    const insertReport = db.prepare('INSERT INTO reports(id, title, category, content) VALUES(?, ?, ?, ?)');
    for (const r of reports) {
      insertReport.run(Number(r.id) || Date.now(), r.title || '', r.category || 'geral', r.content || '');
      counts.reports++;
    }
  }
  console.log(`  -> ${counts.reports} reports\n`);

  // 7. Migrate toolbox codes and config
  console.log('[7/8] Migrating toolbox data...');
  const toolbox = loadJson(path.join(BASE, 'toolbox.json'));
  if (toolbox && Array.isArray(toolbox.codes)) {
    const insertCode = db.prepare('INSERT INTO toolbox_codes(codigo, descricao) VALUES(?, ?)');
    for (const c of toolbox.codes) {
      insertCode.run(c.codigo || '', c.descricao || '');
      counts.toolboxCodes++;
    }
  }

  const folderColors = loadJson(path.join(BASE, 'folder-colors.json'));
  if (folderColors) {
    db.prepare('INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)').run('folder-colors', JSON.stringify(folderColors));
    counts.config++;
  }

  const toolboxConfig = loadJson(path.join(BASE, 'toolbox-config.json'));
  if (toolboxConfig) {
    db.prepare('INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)').run('toolbox-config', JSON.stringify(toolboxConfig));
    counts.config++;
  }

  const toolboxCache = loadJson(path.join(BASE, 'toolbox-cache.json'));
  if (toolboxCache && typeof toolboxCache === 'object') {
    const insertCache = db.prepare('INSERT OR REPLACE INTO cnpj_cache(cnpj, data, cached_at) VALUES(?, ?, ?)');
    for (const [cnpj, entry] of Object.entries(toolboxCache)) {
      insertCache.run(cnpj, JSON.stringify(entry.data || entry), entry.at ? new Date(entry.at).toISOString() : new Date().toISOString());
      counts.cnpjCache++;
    }
  }
  console.log(`  -> ${counts.toolboxCodes} toolbox codes, ${counts.config} config entries, ${counts.cnpjCache} CNPJ cache entries\n`);

  // 8. Migrate bot config
  console.log('[8/8] Migrating bot config...');
  const botConfig = loadJson(path.join(BASE, 'bot-config.json'));
  if (botConfig && botConfig.token) {
    db.prepare('INSERT OR REPLACE INTO bot_config(key, value) VALUES(?, ?)').run('token', botConfig.token);
    counts.botConfig++;
  }
  console.log(`  -> ${counts.botConfig} bot config entries\n`);

  closeDb();

  console.log('=== Migration complete! ===');
  console.log(`Database: aps-assistance.db`);
  console.log(`Total: ${counts.folders} folders, ${counts.files} files, ${counts.tags} tags,`);
  console.log(`  ${counts.trash} trash, ${counts.favorites} favorites, ${counts.diary} diary,`);
  console.log(`  ${counts.reports} reports, ${counts.toolboxCodes} toolbox codes`);
}

migrate();
