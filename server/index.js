// ============================================================================
// APS ASSISTANCE - Servidor Backend (Express + Socket.IO)
// ----------------------------------------------------------------------------
// Responsavel por:
//   - Servir a API REST consumida pelo frontend React (dist)
//   - Armazenar os erros catalogados como arquivos .md na pasta /notion
//   - Disponibilizar busca, tags, favoritos, lixeira, diario e relatorios
//   - Toolbox: codigos de observacao, status SEFAZ, consulta CNPJ e chave NFe
//   - Gerenciar o bot do Telegram (inicializacao, notificacoes e encerramento)
// ============================================================================
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initBot, sendNotification, stopBot } from './telegram-bot.js';

// Encerramento gracioso do servidor ao receber SIGINT/SIGTERM
process.on('SIGINT', () => handleQuit());
process.on('SIGTERM', () => handleQuit());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivos de configuracao persistidos em JSON no diretorio do servidor
const BOT_CONFIG_FILE = path.join(__dirname, '..', 'bot-config.json');
const DIARY_FILE = path.join(__dirname, '..', 'diary.json');

// Carrega a configuracao do bot (token do Telegram) a partir do arquivo
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

// ===== APONTAMENTOS DE ARMAZENAMENTO EM ARQUIVO =====
// O sistema persiste tudo em disco (sem banco de dados):
//   - NOTION_PATH: raiz com as pastas de erros (.md + _images)
//   - favorites/folder-colors/reports: arquivos JSON de estado da interface
//   - TRASH_FOLDER: pasta "_erros_nao_catalogados" que funciona como lixeira
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

// ===== MIDDLEWARES =====
// body parser JSON com limite ampliado (10mb) para uploads de anexos base64,
// servir a build do frontend (dist) e a lixeira/pasta de imagens
app.use(express.json({ limit: '10mb' }));

// Criar pasta de lixo se não existir
const trashPath = path.join(NOTION_PATH, TRASH_FOLDER);
if (!fs.existsSync(trashPath)) {
  fs.mkdirSync(trashPath, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Public form page (standalone HTML, no React)
app.get('/cadastrar', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'cadastrar.html'));
});

// Leitura/gravacao dos favoritos armazenados em favorites.json
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

// ===== FOLDERS (CRUD de pastas/sistemas) =====
// Cada pasta em /notion representa um sistema; as rotas abaixo criam,
// renomeiam e excluem pastas, notificando os clientes via socket.io
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

// Exclui a pasta; os arquivos .md que ainda existirem sao movidos para a lixeira
app.delete('/api/folders/:name', (req, res) => {
  const folderPath = resolveFolderPath(req.params.name);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
  if (files.length > 0) {
    const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    
    files.forEach(file => {
      const source = path.join(folderPath, file);
      const dest = path.join(trashDir, `${path.basename(folderPath)}__${file}`);
      fs.renameSync(source, dest);
    });
  }

  fs.rmSync(folderPath, { recursive: true });
  io.emit('data-changed');
  res.json({ success: true, movedFiles: files.length });
});

// Resolve o caminho real de uma pasta comparando nomes normalizados em Unicode
// (necessario pois o browser pode enviar a acentuacao de forma diferente)
function resolveFolderPath(requestedFolder) {
  if (!fs.existsSync(NOTION_PATH)) return null;
  const dirs = fs.readdirSync(NOTION_PATH).filter(f => fs.statSync(path.join(NOTION_PATH, f)).isDirectory());
  const normReq = requestedFolder.normalize('NFC');
  for (const d of dirs) {
    if (d.normalize('NFC') === normReq) return path.join(NOTION_PATH, d);
  }
  return null;
}

// ===== FILES (CRUD de erros em arquivos .md) =====
// Cada erro catalogado e um arquivo markdown dentro da pasta do sistema.
// Alteracoes emitem "data-changed" (socket.io) e notificam via Telegram
app.get('/api/files/:folder', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.json([]);
  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f.replace('.md', ''), filename: f, folder: path.basename(folderPath) }));
  res.json(files);
});

app.get('/api/file/:folder/:filename', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  const filePath = path.join(folderPath, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ content, filename: req.params.filename, folder: path.basename(folderPath) });
});

app.post('/api/file/:folder', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  const targetPath = folderPath || path.join(NOTION_PATH, req.params.folder);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const filePath = path.join(targetPath, req.body.filename + '.md');
  fs.writeFileSync(filePath, content, 'utf8');
  io.emit('data-changed');
  sendNotification(`📝 *Novo erro criado:*\n${filename} (${folder})`);
  res.json({ success: true, filename });
});

app.put('/api/file/:folder/:filename', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  const filePath = path.join(folderPath, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  fs.writeFileSync(filePath, req.body.content, 'utf8');
  io.emit('data-changed');
  sendNotification(`✏️ *Erro atualizado:*\n${req.params.filename.replace('.md', '')} (${path.basename(folderPath)})`);
  res.json({ success: true });
});

app.delete('/api/file/:folder/:filename', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  const filePath = path.join(folderPath, req.params.filename);
  
  if (fs.existsSync(filePath)) {
    const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    const dest = path.join(trashDir, `${path.basename(folderPath)}__${req.params.filename}`);
    fs.renameSync(filePath, dest);
  }
  
  io.emit('data-changed');
  sendNotification(`🗑️ *Erro excluido:*\n${req.params.filename.replace('.md', '')} (${path.basename(folderPath)})`);
  res.json({ success: true });
});

// Atualizar tags de um arquivo
// Remove a secao "## Tags" existente no markdown e grava a nova lista
app.put('/api/file/:folder/:filename/tags', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  const filePath = path.join(folderPath, req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remover seção de tags existente
  content = content.replace(/\n## Tags\n[\s\S]*?(?=\n## |\n# |\nÚltima|$)/, '');
  
  // Adicionar novas tags
  if (req.body.tags && req.body.tags.length > 0) {
    const tagsSection = '\n## Tags\n' + req.body.tags.map(t => `- ${t}`).join('\n');
    content += tagsSection;
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  io.emit('data-changed');
  res.json({ success: true });
});

app.put('/api/file/:folder/:filename/rename', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  let { newFilename } = req.body;
  if (!newFilename) return res.status(400).json({ error: 'Nome obrigatorio' });
  if (!newFilename.endsWith('.md')) newFilename += '.md';
  const oldPath = path.join(folderPath, req.params.filename);
  const newPath = path.join(folderPath, newFilename);
  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  if (fs.existsSync(newPath) && oldPath !== newPath) {
    return res.status(400).json({ error: 'Já existe um arquivo com esse nome' });
  }
  fs.renameSync(oldPath, newPath);
  io.emit('data-changed');
  sendNotification(`📝 *Erro renomeado:*\n${req.params.filename.replace('.md', '')} → ${newFilename.replace('.md', '')} (${path.basename(folderPath)})`);
  res.json({ success: true, newFilename });
});

app.put('/api/file/:folder/:filename/move', (req, res) => {
  const folderPath = resolveFolderPath(req.params.folder);
  if (!folderPath) return res.status(404).json({ error: 'Pasta não encontrada' });
  const sourcePath = path.join(folderPath, req.params.filename);
  const targetFolderPath = resolveFolderPath(req.body.targetFolder);
  if (!targetFolderPath) {
    return res.status(404).json({ error: 'Pasta destino não encontrada' });
  }
  if (!fs.existsSync(sourcePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }
  const targetPath = path.join(targetFolderPath, req.params.filename);
  if (fs.existsSync(targetPath)) {
    return res.status(400).json({ error: 'Já existe um arquivo com esse nome na pasta destino' });
  }
  fs.renameSync(sourcePath, targetPath);
  io.emit('data-changed');
  sendNotification(`📦 *Erro movido:*\n${req.params.filename.replace('.md', '')}\n${path.basename(folderPath)} → ${path.basename(targetFolderPath)}`);
  res.json({ success: true });
});

// ===== SEARCH (busca simples e busca avancada) =====
// Varre o conteudo de todos os .md buscando a palavra-chave (e as tags),
// retornando trecho inicial do arquivo e as tags de cada resultado
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

// Busca avancada: combina palavra-chave, pasta, tags e intervalo de datas
// (a data e extraida do campo "Criado em" presente no markdown)
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

// ===== STATS =====
// Estatisticas gerais: total de erros por pasta, arquivos recentemente
// modificados (top 10) e contagem de uso de cada tag
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

// ===== FAVORITES (erros favoritados) =====
// CRUD de favoritos persistido em favorites.json, sem duplicatas
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

// ===== TAGS =====
// Mapa de todas as tags existentes nos arquivos, com a lista de erros de cada uma
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

// ===== TRASH (lixeira de erros nao catalogados) =====
// Arquivos excluidos vao para "_erros_nao_catalogados" com o prefixo
// "pastaOrigem__nome_arquivo", permitindo restauracao ou exclusao definitiva
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

// Devolve o arquivo para a pasta de origem (reconstituida a partir do prefixo,
// com fallback para "scgwin" caso o nome nao siga o padrao)
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

// Exclusao definitiva de um arquivo da lixeira e esvaziamento total da lixeira
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

// ===== FOLDER COLORS (cores personalizadas por pasta) =====
// Persistidas em folder-colors.json; cores default para os sistemas conhecidos
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

// ===== REPORTS (relatorios pre-definidos) =====
// CRUD de relatorios persistido em reports.json, iniciando com defaults
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

// ===== DIARY (diario de ocorrencias) =====
// Registro diario de ocorrencias com categoria, prioridade, autor e turno;
// suporta filtro por data e busca por texto (persistido em diary.json)
// Diary CRUD
function loadDiary() {
  if (!fs.existsSync(DIARY_FILE)) {
    fs.writeFileSync(DIARY_FILE, '[]', 'utf8');
    return [];
  }
  try { return JSON.parse(fs.readFileSync(DIARY_FILE, 'utf8')); } catch (e) { return []; }
}
function saveDiary(entries) {
  fs.writeFileSync(DIARY_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

app.get('/api/diary', (req, res) => {
  const { date, search } = req.query;
  let entries = loadDiary();
  if (date) entries = entries.filter(e => e.date === date);
  if (search) {
    const q = search.toLowerCase();
    entries = entries.filter(e => e.content.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || (e.author || '').toLowerCase().includes(q));
  }
  entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(entries);
});

app.post('/api/diary', (req, res) => {
  const { title, content, category, priority, author, shift } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Titulo e conteudo obrigatorios' });
  const entries = loadDiary();
  const entry = {
    id: Date.now().toString(),
    title,
    content,
    category: category || 'ocorrencia',
    priority: priority || 'normal',
    author: author || 'Anonimo',
    shift: shift || '',
    date: new Date().toLocaleDateString('pt-BR'),
    createdAt: new Date().toISOString(),
    resolved: false
  };
  entries.push(entry);
  saveDiary(entries);
  io.emit('data-changed');
  res.json(entry);
});

app.put('/api/diary/:id', (req, res) => {
  const { id } = req.params;
  const { resolved, content, priority } = req.body;
  const entries = loadDiary();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Entrada nao encontrada' });
  if (resolved !== undefined) {
    entries[idx].resolved = resolved;
    if (resolved) entries[idx].resolvedAt = new Date().toISOString();
    else entries[idx].resolvedAt = null;
  }
  if (content !== undefined) entries[idx].content = content;
  if (priority !== undefined) entries[idx].priority = priority;
  entries[idx].updatedAt = new Date().toISOString();
  saveDiary(entries);
  io.emit('data-changed');
  res.json(entries[idx]);
});

app.delete('/api/diary/:id', (req, res) => {
  const { id } = req.params;
  let entries = loadDiary();
  entries = entries.filter(e => e.id !== id);
  saveDiary(entries);
  io.emit('data-changed');
  res.json({ success: true });
});

// ===== TOOLBOX - CODIGOS DE OBSERVACAO =====
// Cadastro de codigos padrao usados nas observacoes (persistido em toolbox.json)
// Toolbox - codigos de observacao
const TOOLBOX_FILE = path.join(__dirname, '..', 'toolbox.json');

function loadToolbox() {
  if (!fs.existsSync(TOOLBOX_FILE)) {
    fs.writeFileSync(TOOLBOX_FILE, JSON.stringify({ codes: [] }, null, 2), 'utf8');
    return { codes: [] };
  }
  try { return JSON.parse(fs.readFileSync(TOOLBOX_FILE, 'utf8')); } catch (e) { return { codes: [] }; }
}
function saveToolbox(data) {
  fs.writeFileSync(TOOLBOX_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/toolbox/codes', (req, res) => {
  res.json(loadToolbox().codes || []);
});

app.post('/api/toolbox/codes', (req, res) => {
  const { codigo, descricao } = req.body;
  if (!codigo || !descricao) return res.status(400).json({ error: 'Codigo e descricao obrigatorios' });
  const data = loadToolbox();
  const item = { id: Date.now().toString(), codigo: String(codigo), descricao: String(descricao) };
  (data.codes ||= []).push(item);
  saveToolbox(data);
  res.json(item);
});

app.put('/api/toolbox/codes/:id', (req, res) => {
  const { id } = req.params;
  const data = loadToolbox();
  const idx = (data.codes || []).findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Codigo nao encontrado' });
  if (req.body.codigo !== undefined) data.codes[idx].codigo = String(req.body.codigo);
  if (req.body.descricao !== undefined) data.codes[idx].descricao = String(req.body.descricao);
  saveToolbox(data);
  res.json(data.codes[idx]);
});

app.delete('/api/toolbox/codes/:id', (req, res) => {
  const { id } = req.params;
  const data = loadToolbox();
  data.codes = (data.codes || []).filter(c => c.id !== id);
  saveToolbox(data);
  res.json({ success: true });
});

// ===== TOOLBOX - STATUS SEFAZ (scraping do portal oficial) =====
// Consulta a pagina de disponibilidade da NFe, seguindo redirecionamentos
// com cookie jar manual e fazendo parsing das tabelas de status por UF
// Toolbox - status SEFAZ (consulta pelo servidor, com cookie jar e parsing do portal oficial)
const SEFAZ_URL = 'https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx';

// Fetch com suporte a cookies de sessao (ASPSESSIONID etc.) e redirecionamentos manuais
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

// Extrai o HTML da tabela de disponibilidade: status por UF (verde/amarelo/
// vermelho) em cada servico (autorizacao, retorno, inutilizacao, etc.)
// e a quantidade de usuarios em contingencia SVC-AN/SVC-RS
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

// Endpoint da consulta SEFAZ: timeout de 15s e resposta normalizada
// ({ ok: true, rows, contingencia } ou { ok: false, error })
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

// ===== TOOLBOX - CONSULTA CNPJ =====
// Fonte principal: ReceitaWS. Enriquecimento da Inscricao Estadual via
// Sintegra (se chave configurada) ou BrasilAPI, com throttle e cache em disco
// Toolbox - consulta CNPJ (ReceitaWS + enriquecimento IE via BrasilAPI com throttle + cache)
const CNPJ_CACHE_FILE = path.join(__dirname, '..', 'toolbox-cache.json');
const CNPJ_CACHE_TTL = 24 * 3600 * 1000;
let LAST_BRASILAPI_AT = 0;
const BRASILAPI_MIN_GAP = 25000;

function loadCnpjCache() {
  try {
    if (fs.existsSync(CNPJ_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CNPJ_CACHE_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}
function saveCnpjCache(cache) {
  try { fs.writeFileSync(CNPJ_CACHE_FILE, JSON.stringify(cache), 'utf8'); } catch (e) { /* ignore */ }
}

// Chave Sintegra (sintegrabrasil.com.br - gratis, 10 req/min)
// Configuracao da Toolbox persistida em toolbox-config.json
const TOOLBOX_CONFIG_FILE = path.join(__dirname, '..', 'toolbox-config.json');
function loadToolboxConfig() {
  try {
    if (fs.existsSync(TOOLBOX_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(TOOLBOX_CONFIG_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}
function saveToolboxConfig(cfg) {
  try { fs.writeFileSync(TOOLBOX_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8'); } catch (e) { /* ignore */ }
}

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

// Consulta a BrasilAPI com espacamento minimo de 25s entre chamadas
// (API publica tem limite agressivo por IP)
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

// Endpoint principal: valida CNPJ (14 digitos), verifica cache, consulta
// ReceitaWS, enriquece IE (Sintegra/BrasilAPI) e grava no cache
app.get('/api/toolbox/cnpj/:cnpj', async (req, res) => {
  const cnpj = (req.params.cnpj || '').replace(/\D/g, '').padStart(14, '0');
  const forceRefresh = req.query.refresh === '1';
  if (cnpj.length !== 14) return res.json({ ok: false, error: 'CNPJ deve ter 14 digitos' });
  const cache = loadCnpjCache();
  const cached = cache[cnpj];
  if (!forceRefresh && cached && Date.now() - cached.at < CNPJ_CACHE_TTL) {
    return res.json({ ok: true, source: 'cache', data: cached.data });
  }
  try {
    // Fonte principal: ReceitaWS (confiavel)
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
      // Enriquecimento com IE (Sintegra se chave configurada, senao BrasilAPI)
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
        } catch (e) { /* Sintegra indisponivel - segue para BrasilAPI */ }
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
      cache[cnpj] = { at: Date.now(), data };
      saveCnpjCache(cache);
      return res.json({ ok: true, source: 'receitaws' + (data.ie ? '+brasilapi' : ''), data });
    }
    // Fallback: BrasilAPI direto
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
      cache[cnpj] = { at: Date.now(), data };
      saveCnpjCache(cache);
      return res.json({ ok: true, source: 'brasilapi', data });
    }
    return res.json({ ok: false, error: 'Falha ao consultar (HTTP ' + (rw.status || 0) + ') - limite de requisicoes atingido, tente novamente em 1 minuto' });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});

// ===== TOOLBOX - CHAVE DE ACESSO NFE =====
// Decodifica a chave de 44 digitos: UF, data de emissao, CNPJ do emitente,
// modelo, serie, numero e tipo de emissao; o digito verificador e recalculado
// para validar a chave (modulo 11 com pesos 2..9)
// Toolbox - validacao e decodificacao de chave de acesso NFe
const NF_UF_CODES = { '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF', '91': 'AN' };

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

// ===== ATTACHMENTS (anexos de arquivos) =====
// Imagens/arquivos sao salvos em /notion/_images/<pasta> com nome unico;
// metadados (nome original) ficam em _metadata.json e a referencia e
// inserida na secao "## Anexos" do markdown
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

// ===== BOT CONFIG (configuracao do bot Telegram) =====
// Exibe o estado do token (mascarado) e permite definir/remover o token,
// reiniciando ou parando o bot conforme o caso
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

// ===== PUBLIC FORM (cadastro publico de erros) =====
// Endpoints usados pela pagina standalone 'cadastrar.html': lista
// folders/tags disponiveis e recebe novos erros da comunidade
// Public form - get folders and tags
app.get('/api/public/folders-tags', (req, res) => {
  const folders = [];
  if (fs.existsSync(NOTION_PATH)) {
    fs.readdirSync(NOTION_PATH)
      .filter(f => fs.statSync(path.join(NOTION_PATH, f)).isDirectory() && f !== TRASH_FOLDER && f !== '_images')
      .forEach(f => folders.push(f));
  }
  const allTags = {};
  for (const folder of folders) {
    const fp = path.join(NOTION_PATH, folder);
    if (!fs.existsSync(fp)) continue;
    fs.readdirSync(fp).filter(f => f.endsWith('.md')).forEach(file => {
      const content = fs.readFileSync(path.join(fp, file), 'utf8');
      const m = content.match(/## Tags\n([\s\S]*?)$/);
      if (m) {
        m[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).filter(Boolean).forEach(tag => {
          allTags[tag] = true;
        });
      }
    });
  }
  res.json({ folders, tags: Object.keys(allTags).sort() });
});

// Public form - submit new error
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
  const fp = path.join(NOTION_PATH, sistema);
  if (!fs.existsSync(fp)) fs.mkdirSync(fp, { recursive: true });
  fs.writeFileSync(path.join(fp, title + '.md'), content, 'utf8');
  sendNotification('📝 *Erro cadastrado via formulario:*\n' + title + '\n📂 ' + sistema);
  res.json({ success: true, message: 'Erro cadastrado com sucesso' });
});

// ===== CICLO DE VIDA DO SERVIDOR =====
// Inicializacao (startServer), reinicio (handleRestart) e encerramento
// (handleQuit); tambem controla a inicializacao do bot do Telegram
app.post('/api/bot-stop', (req, res) => {
  stopBot();
  res.json({ success: true, message: 'Bot parado' });
});

// Sobe o servidor HTTP na porta 3000, exibe o banner com IPs da rede
// e ativa o bot do Telegram caso exista token configurado
function startServer() {
  httpServer.listen(PORT, '0.0.0.0', () => {
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    console.log(`\n   ╔══════════════════════════════════════╗`);
    console.log(`   ║     APS Assistance - ONLINE          ║`);
    console.log(`   ╚══════════════════════════════════════╝`);
    console.log(`\n   Local:   http://localhost:${PORT}`);
    
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
      sendNotification('🟢 *Servidor ONLINE*\nHorario: ' + now);
    } else {
      console.log(`   Telegram: desativado (configure bot-config.json)`);
    }

    console.log(`\n   ╔══════════════════════════════════════╗`);
    console.log(`   ║  [R] Reiniciar Servidor              ║`);
    console.log(`   ║  [Q] Sair                            ║`);
    console.log(`   ╚══════════════════════════════════════╝\n`);
  });
}

// Reinicia o servidor: para o bot, fecha o HTTP e sobe tudo novamente
function handleRestart() {
  console.log('\n   Reiniciando servidor...');
  sendNotification('🔄 *Servidor REINICIANDO*');
  setTimeout(() => {
    stopBot();
    httpServer.close(() => {
      startServer();
    });
  }, 500);
}

// Encerra o servidor, notificando no Telegram antes de sair do processo
function handleQuit() {
  console.log('\n   Encerrando servidor...');
  sendNotification('🔴 *Servidor OFFLINE*');
  setTimeout(() => { stopBot(); process.exit(0); }, 500);
}

startServer();

// Atalhos de teclado do terminal quando em modo TTY: [R] reinicia, [Q] sai
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (key) => {
    const k = key.toString().toLowerCase();
    if (k === 'r') handleRestart();
    if (k === 'q' || k === '\u0003') handleQuit();
  });
}

