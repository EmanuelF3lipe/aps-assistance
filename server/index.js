import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initBot, sendNotification, stopBot } from './telegram-bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_CONFIG_FILE = path.join(__dirname, '..', 'bot-config.json');

function loadBotConfig() {
  if (fs.existsSync(BOT_CONFIG_FILE)) {
    try { return JSON.parse(fs.readFileSync(BOT_CONFIG_FILE, 'utf8')); } catch (e) {}
  }
  return { token: '' };
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const PORT = 3000;

const NOTION_PATH = path.join(__dirname, '..', '..', 'notion');
const FAVORITES_FILE = path.join(__dirname, '..', 'favorites.json');
const REPORTS_FILE = path.join(__dirname, '..', 'reports.json');
const FOLDER_COLORS_FILE = path.join(__dirname, '..', 'folder-colors.json');
const IMAGES_DIR = path.join(NOTION_PATH, '_images');
const TRASH_FOLDER = '_erros_nao_catalogados';

// Criar pasta de imagens se não existir
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Parse multipart form data (simples, sem dependência)
app.use(express.json({ limit: '10mb' }));

// Criar pasta de lixo se não existir
const trashPath = path.join(NOTION_PATH, TRASH_FOLDER);
if (!fs.existsSync(trashPath)) {
  fs.mkdirSync(trashPath, { recursive: true });
}

app.use(express.json());
app.use(express.static('dist'));

function loadFavorites() {
  if (fs.existsSync(FAVORITES_FILE)) {
    return JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
  }
  return [];
}

function saveFavorites(favs) {
  fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favs, null, 2), 'utf8');
}

function getAllFolders() {
  if (!fs.existsSync(NOTION_PATH)) return [];
  return fs.readdirSync(NOTION_PATH)
    .filter(f => fs.statSync(path.join(NOTION_PATH, f)).isDirectory() && f !== TRASH_FOLDER && f !== '_images')
    .map(f => ({ name: f, path: f }));
}

app.get('/api/folders', (req, res) => {
  res.json(getAllFolders());
});

app.post('/api/folders', (req, res) => {
  const { name } = req.body;
  const folderPath = path.join(NOTION_PATH, name);
  if (fs.existsSync(folderPath)) {
    return res.status(400).json({ error: 'Pasta já existe' });
  }
  fs.mkdirSync(folderPath, { recursive: true });
  io.emit('data-changed');
  res.json({ success: true });
});

app.put('/api/folders/:oldName', (req, res) => {
  const { oldName } = req.params;
  const { newName } = req.body;
  const oldPath = path.join(NOTION_PATH, oldName);
  const newPath = path.join(NOTION_PATH, newName);
  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ error: 'Pasta não encontrada' });
  }
  if (fs.existsSync(newPath) && oldPath !== newPath) {
    return res.status(400).json({ error: 'Já existe uma pasta com esse nome' });
  }
  fs.renameSync(oldPath, newPath);
  io.emit('data-changed');
  res.json({ success: true });
});

app.delete('/api/folders/:name', (req, res) => {
  const { name } = req.params;
  const folderPath = path.join(NOTION_PATH, name);
  
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Pasta não encontrada' });
  }

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
  if (files.length > 0) {
    const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    
    files.forEach(file => {
      const source = path.join(folderPath, file);
      const dest = path.join(trashDir, `${name}__${file}`);
      fs.renameSync(source, dest);
    });
  }

  fs.rmSync(folderPath, { recursive: true });
  io.emit('data-changed');
  res.json({ success: true, movedFiles: files.length });
});

app.get('/api/files/:folder', (req, res) => {
  const folder = req.params.folder;
  const folderPath = path.join(NOTION_PATH, folder);
  if (!fs.existsSync(folderPath)) return res.json([]);
  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f.replace('.md', ''), filename: f, folder }));
  res.json(files);
});

app.get('/api/file/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join(NOTION_PATH, folder, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ content, filename, folder });
});

app.post('/api/file/:folder', (req, res) => {
  const folder = req.params.folder;
  const { filename, content } = req.body;
  const folderPath = path.join(NOTION_PATH, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  const filePath = path.join(folderPath, filename + '.md');
  fs.writeFileSync(filePath, content, 'utf8');
  io.emit('data-changed');
  sendNotification(`📝 *Novo erro criado:*\n${filename} (${folder})`);
  res.json({ success: true, filename });
});

app.put('/api/file/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const { content } = req.body;
  const filePath = path.join(NOTION_PATH, folder, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  io.emit('data-changed');
  sendNotification(`✏️ *Erro atualizado:*\n${filename.replace('.md', '')} (${folder})`);
  res.json({ success: true });
});

app.delete('/api/file/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join(NOTION_PATH, folder, filename);
  
  if (fs.existsSync(filePath)) {
    const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    const dest = path.join(trashDir, `${folder}__${filename}`);
    fs.renameSync(filePath, dest);
  }
  
  io.emit('data-changed');
  sendNotification(`🗑️ *Erro excluido:*\n${filename.replace('.md', '')} (${folder})`);
  res.json({ success: true });
});

// Atualizar tags de um arquivo
app.put('/api/file/:folder/:filename/tags', (req, res) => {
  const { folder, filename } = req.params;
  const { tags } = req.body;
  const filePath = path.join(NOTION_PATH, folder, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remover seção de tags existente
  content = content.replace(/\n## Tags\n[\s\S]*?(?=\n## |\n# |\nÚltima|$)/, '');
  
  // Adicionar novas tags
  if (tags && tags.length > 0) {
    const tagsSection = '\n## Tags\n' + tags.map(t => `- ${t}`).join('\n');
    content += tagsSection;
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  io.emit('data-changed');
  res.json({ success: true });
});

app.put('/api/file/:folder/:filename/rename', (req, res) => {
  const { folder, filename } = req.params;
  const { newFilename } = req.body;
  const oldPath = path.join(NOTION_PATH, folder, filename);
  const newPath = path.join(NOTION_PATH, folder, newFilename);
  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  if (fs.existsSync(newPath) && oldPath !== newPath) {
    return res.status(400).json({ error: 'Já existe um arquivo com esse nome' });
  }
  fs.renameSync(oldPath, newPath);
  io.emit('data-changed');
  sendNotification(`📝 *Erro renomeado:*\n${filename.replace('.md', '')} → ${newFilename.replace('.md', '')} (${folder})`);
  res.json({ success: true, newFilename });
});

app.put('/api/file/:folder/:filename/move', (req, res) => {
  const { folder, filename } = req.params;
  const { targetFolder } = req.body;
  const sourcePath = path.join(NOTION_PATH, folder, filename);
  const targetDir = path.join(NOTION_PATH, targetFolder);
  if (!fs.existsSync(sourcePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const targetPath = path.join(targetDir, filename);
  if (fs.existsSync(targetPath)) {
    return res.status(400).json({ error: 'Já existe um arquivo com esse nome na pasta destino' });
  }
  fs.renameSync(sourcePath, targetPath);
  io.emit('data-changed');
  sendNotification(`📦 *Erro movido:*\n${filename.replace('.md', '')}\n${folder} → ${targetFolder}`);
  res.json({ success: true });
});

app.get('/api/search', (req, res) => {
  const query = req.query.q.toLowerCase();
  const results = [];
  const folders = getAllFolders();
  folders.forEach(({ path: folder }) => {
    const folderPath = path.join(NOTION_PATH, folder);
    if (!fs.existsSync(folderPath)) return;
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
      if (content.toLowerCase().includes(query) || file.toLowerCase().includes(query)) {
        const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
        const tags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];
        results.push({ name: file.replace('.md', ''), filename: file, folder, excerpt: content.substring(0, 150), tags });
      }
    });
  });
  res.json(results);
});

app.get('/api/search/advanced', (req, res) => {
  const { q, folder, tags, dateFrom, dateTo } = req.query;
  const query = q ? q.toLowerCase() : '';
  const results = [];
  const folders = getAllFolders();

  folders.forEach(({ path: folderPath }) => {
    if (folder && folderPath !== folder) return;

    const fullFolderPath = path.join(NOTION_PATH, folderPath);
    if (!fs.existsSync(fullFolderPath)) return;

    const files = fs.readdirSync(fullFolderPath).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(fullFolderPath, file), 'utf8');

      if (query && !content.toLowerCase().includes(query) && !file.toLowerCase().includes(query)) return;

      if (tags) {
        const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
        const fileTags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];
        const searchTags = tags.split(',').map(t => t.trim().toLowerCase());
        if (!searchTags.some(st => fileTags.some(ft => ft.toLowerCase().includes(st)))) return;
      }

      if (dateFrom || dateTo) {
        const dateMatch = content.match(/\*\*Criado em:\*\*\s*(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          const [, dateStr] = dateMatch;
          const [day, month, year] = dateStr.split('/');
          const fileDate = new Date(year, month - 1, day);
          if (dateFrom) {
            const [fy, fm, fd] = dateFrom.split('-');
            const fromDate = new Date(fy, fm - 1, fd);
            if (fileDate < fromDate) return;
          }
          if (dateTo) {
            const [ty, tm, td] = dateTo.split('-');
            const toDate = new Date(ty, tm - 1, td);
            if (fileDate > toDate) return;
          }
        }
      }

      const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
      const fileTags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];

      results.push({
        name: file.replace('.md', ''),
        filename: file,
        folder: folderPath,
        excerpt: content.substring(0, 150),
        tags: fileTags
      });
    });
  });

  res.json(results);
});

app.get('/api/stats', (req, res) => {
  const folders = getAllFolders();
  const stats = { total: 0, byFolder: {}, recentFiles: [], tags: {} };
  folders.forEach(({ path: folder }) => {
    const folderPath = path.join(NOTION_PATH, folder);
    if (!fs.existsSync(folderPath)) { stats.byFolder[folder] = 0; return; }
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
    stats.byFolder[folder] = files.length;
    stats.total += files.length;
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      stats.recentFiles.push({ name: file.replace('.md', ''), filename: file, folder, modified: stat.mtime });
      const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
      if (tagMatch) {
        tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).forEach(tag => {
          stats.tags[tag] = (stats.tags[tag] || 0) + 1;
        });
      }
    });
  });
  stats.recentFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  stats.recentFiles = stats.recentFiles.slice(0, 10);
  res.json(stats);
});

app.get('/api/favorites', (req, res) => {
  res.json(loadFavorites());
});

app.post('/api/favorites', (req, res) => {
  const { filename, folder } = req.body;
  const favs = loadFavorites();
  if (!favs.find(f => f.filename === filename && f.folder === folder)) {
    favs.push({ filename, folder, added: new Date() });
    saveFavorites(favs);
  }
  io.emit('data-changed');
  res.json({ success: true });
});

app.delete('/api/favorites/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  let favs = loadFavorites();
  favs = favs.filter(f => !(f.filename === filename && f.folder === folder));
  saveFavorites(favs);
  io.emit('data-changed');
  res.json({ success: true });
});

app.get('/api/tags', (req, res) => {
  const tags = {};
  const folders = getAllFolders();
  folders.forEach(({ path: folder }) => {
    const folderPath = path.join(NOTION_PATH, folder);
    if (!fs.existsSync(folderPath)) return;
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
      const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
      if (tagMatch) {
        tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).forEach(tag => {
          if (!tags[tag]) tags[tag] = [];
          tags[tag].push({ filename: file, folder });
        });
      }
    });
  });
  res.json(tags);
});

// Trash endpoints
app.get('/api/trash', (req, res) => {
  const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
  if (!fs.existsSync(trashDir)) return res.json([]);
  
  const files = fs.readdirSync(trashDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const parts = f.split('__');
      const originalFolder = parts.length > 1 ? parts[0] : 'desconhecido';
      const originalName = parts.length > 1 ? parts.slice(1).join('__').replace('.md', '') : f.replace('.md', '');
      return {
        name: originalName,
        filename: f,
        folder: TRASH_FOLDER,
        originalFolder: originalFolder
      };
    });
  
  res.json(files);
});

app.put('/api/trash/restore/:filename', (req, res) => {
  const { filename } = req.params;
  const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
  const filePath = path.join(trashDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  
  const parts = filename.split('__');
  const originalFolder = parts.length > 1 ? parts[0] : 'scgwin';
  const originalFilename = parts.length > 1 ? parts.slice(1).join('__') : filename;
  
  const targetDir = path.join(NOTION_PATH, originalFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const targetPath = path.join(targetDir, originalFilename);
  fs.renameSync(filePath, targetPath);
  
  io.emit('data-changed');
  res.json({ success: true });
});

app.delete('/api/trash/:filename', (req, res) => {
  const { filename } = req.params;
  const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
  const filePath = path.join(trashDir, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  io.emit('data-changed');
  res.json({ success: true });
});

app.delete('/api/trash', (req, res) => {
  const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
  if (fs.existsSync(trashDir)) {
    const files = fs.readdirSync(trashDir).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      fs.unlinkSync(path.join(trashDir, file));
    });
  }
  io.emit('data-changed');
  res.json({ success: true });
});

// Folder Colors
function loadFolderColors() {
  if (!fs.existsSync(FOLDER_COLORS_FILE)) {
    const defaults = {
      scgwin: '#3b82f6',
      agilis: '#10b981',
      corpore: '#f59e0b',
      sgnfe: '#8b5cf6'
    };
    fs.writeFileSync(FOLDER_COLORS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
    return defaults;
  }
  return JSON.parse(fs.readFileSync(FOLDER_COLORS_FILE, 'utf8'));
}

function saveFolderColors(colors) {
  fs.writeFileSync(FOLDER_COLORS_FILE, JSON.stringify(colors, null, 2), 'utf8');
}

app.get('/api/folder-colors', (req, res) => {
  const colors = loadFolderColors();
  res.json(colors);
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

// Reports CRUD
function loadReports() {
  if (!fs.existsSync(REPORTS_FILE)) {
    const defaults = [
      { id: '1', title: 'Relatório de Vendas', category: 'vendas', content: 'Relatório com todas as vendas do período.' },
      { id: '2', title: 'Relatório Financeiro', category: 'financeiro', content: 'Relatório com dados financeiros gerais.' },
      { id: '3', title: 'Relatório de Estoque', category: 'estoque', content: 'Relatório com status do estoque.' },
      { id: '4', title: 'Relatório de Compras', category: 'compras', content: 'Relatório com pedidos de compra.' },
      { id: '5', title: 'Relatório Gerencial', category: 'gerenciais', content: 'Relatório para gestores.' },
      { id: '6', title: 'Relatório de Clientes', category: 'clientes', content: 'Relatório com dados dos clientes.' }
    ];
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
    return defaults;
  }
  return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
}

function saveReports(reports) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
}

app.get('/api/reports', (req, res) => {
  const reports = loadReports();
  res.json(reports);
});

app.post('/api/reports', (req, res) => {
  const { title, category, content } = req.body;
  if (!title) return res.status(400).json({ error: 'Titulo obrigatorio' });
  const reports = loadReports();
  const newReport = {
    id: Date.now().toString(),
    title,
    category: category || 'geral',
    content: content || ''
  };
  reports.push(newReport);
  saveReports(reports);
  io.emit('data-changed');
  res.json(newReport);
});

app.put('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  const { title, category, content } = req.body;
  const reports = loadReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Relatorio nao encontrado' });
  if (title !== undefined) reports[idx].title = title;
  if (category !== undefined) reports[idx].category = category;
  if (content !== undefined) reports[idx].content = content;
  saveReports(reports);
  io.emit('data-changed');
  res.json(reports[idx]);
});

app.delete('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  let reports = loadReports();
  reports = reports.filter(r => r.id !== id);
  saveReports(reports);
  io.emit('data-changed');
  res.json({ success: true });
});

// Attachment endpoints
// Upload de arquivo (base64)
app.post('/api/attachments/upload', (req, res) => {
  const { folder, filename, fileData, originalName } = req.body;
  
  if (!fileData || !originalName) {
    return res.status(400).json({ error: 'Dados do arquivo nao fornecidos' });
  }

  // Gerar nome unico
  const ext = path.extname(originalName) || '.bin';
  const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  
  // Criar pasta da pasta de origem
  const folderDir = path.join(IMAGES_DIR, folder.replace(/\//g, '_'));
  if (!fs.existsSync(folderDir)) {
    fs.mkdirSync(folderDir, { recursive: true });
  }

  // Decodificar base64 e salvar
  const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
  const filePath = path.join(folderDir, uniqueName);
  
  try {
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    // Salvar metadados com nome original
    const metaFile = path.join(folderDir, '_metadata.json');
    let metadata = {};
    if (fs.existsSync(metaFile)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      } catch (e) {}
    }
    metadata[uniqueName] = originalName;
    fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2), 'utf8');
    
    // Salvar referência no arquivo .md
    if (filename) {
      const mdPath = path.join(NOTION_PATH, folder, filename);
      if (fs.existsSync(mdPath)) {
        let content = fs.readFileSync(mdPath, 'utf8');
        const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(originalName);
        const attachRef = isImage 
          ? `\n![${originalName}](/_images/${folder.replace(/\//g, '_')}/${uniqueName})`
          : `\n[ ${originalName} ](/_images/${folder.replace(/\//g, '_')}/${uniqueName})`;
        
        // Verificar se já existe seção de anexos
        if (content.includes('## Anexos')) {
          content = content.replace('## Anexos\n', `## Anexos\n${attachRef}\n`);
        } else {
          content += `\n\n## Anexos\n${attachRef}`;
        }
        
        fs.writeFileSync(mdPath, content, 'utf8');
      }
    }
    
    res.json({ success: true, attachPath: `/_images/${folder.replace(/\//g, '_')}/${uniqueName}` });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar arquivo' });
  }
});

// Listar anexos de um arquivo
app.get('/api/attachments/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const folderDir = path.join(IMAGES_DIR, folder.replace(/\//g, '_'));
  
  if (!fs.existsSync(folderDir)) {
    return res.json([]);
  }
  
  // Carregar metadados de nomes originais
  const metaFile = path.join(folderDir, '_metadata.json');
  let metadata = {};
  if (fs.existsSync(metaFile)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    } catch (e) {}
  }
  
  // Procurar anexos referenciados no arquivo
  const mdPath = path.join(NOTION_PATH, folder, filename);
  let referencedFiles = [];
  
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf8');
    const attachRegex = /\!\[.*?\]\(\/_images\/([^)]+)\)|\[\s*.*?\]\(\/_images\/([^)]+)\)/g;
    let match;
    while ((match = attachRegex.exec(content)) !== null) {
      const ref = match[1] || match[2];
      if (ref) referencedFiles.push(ref);
    }
  }
  
  const allFiles = fs.readdirSync(folderDir).filter(f => f !== '_metadata.json');
  const attachments = allFiles
    .filter(f => referencedFiles.some(ref => ref.endsWith(f)))
    .map(f => {
      const isImage = /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(f);
      const originalName = metadata[f] || f;
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

// Deletar anexo
app.delete('/api/attachments/:folder/:fileName', (req, res) => {
  const { folder, fileName } = req.params;
  const filePath = path.join(IMAGES_DIR, folder.replace(/\//g, '_'), fileName);
  
  // Remover arquivo
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // Remover referência do markdown
  const folderDir = path.join(NOTION_PATH, folder);
  if (fs.existsSync(folderDir)) {
    const files = fs.readdirSync(folderDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const mdPath = path.join(folderDir, file);
      let content = fs.readFileSync(mdPath, 'utf8');
      const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const attachRefRegex = new RegExp(`\\!\\[.*?\\]\\(/_images/${folder.replace(/\//g, '_')}/${escapedFileName}\\)|\\[\\s*.*?\\]\\(/_images/${folder.replace(/\//g, '_')}/${escapedFileName}\\)`, 'g');
      if (attachRefRegex.test(content)) {
        content = content.replace(attachRefRegex, '');
        // Remover seção "## Anexos" se estiver vazia
        content = content.replace(/## Anexos\n\n*/g, '');
        fs.writeFileSync(mdPath, content, 'utf8');
        break;
      }
    }
  }
  
  res.json({ success: true });
});

// Servir imagens estáticas
app.use('/_images', express.static(IMAGES_DIR));

// Bot config
app.get('/api/bot-config', (req, res) => {
  const config = loadBotConfig();
  res.json({ token: config.token ? '***configurado***' : '' });
});

app.put('/api/bot-config', (req, res) => {
  const { token } = req.body;
  const config = { token: token || '' };
  fs.writeFileSync(BOT_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n APS Assistance rodando em:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   Rede:    http://${net.address}:${PORT}`);
      }
    }
  }

  const botConfig = loadBotConfig();
  if (botConfig.token) {
    initBot(botConfig.token);
    console.log(`   Telegram: bot ativo`);
  } else {
    console.log(`   Telegram: desativado (configure bot-config.json)`);
  }

  console.log(`\n   Acesse de outra máquina: http://<IP_DA_REDE>:${PORT}\n`);
});
