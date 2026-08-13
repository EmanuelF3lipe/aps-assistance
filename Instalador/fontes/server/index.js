import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
  res.json({ success: true });
});

app.delete('/api/folders/:name', (req, res) => {
  const { name } = req.params;
  const folderPath = path.join(NOTION_PATH, name);
  
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Pasta não encontrada' });
  }

  // Mover arquivos para pasta de lixo antes de excluir
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
  res.json({ success: true });
});

app.delete('/api/file/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const filePath = path.join(NOTION_PATH, folder, filename);
  
  if (fs.existsSync(filePath)) {
    // Mover para pasta de lixo
    const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    const dest = path.join(trashDir, `${folder}__${filename}`);
    fs.renameSync(filePath, dest);
  }
  
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
  res.json({ success: true });
});

app.delete('/api/favorites/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  let favs = loadFavorites();
  favs = favs.filter(f => !(f.filename === filename && f.folder === folder));
  saveFavorites(favs);
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
  
  res.json({ success: true });
});

app.delete('/api/trash/:filename', (req, res) => {
  const { filename } = req.params;
  const trashDir = path.join(NOTION_PATH, TRASH_FOLDER);
  const filePath = path.join(trashDir, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
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
  res.json({ success: true });
});

app.delete('/api/folder-colors/:folder', (req, res) => {
  const { folder } = req.params;
  const colors = loadFolderColors();
  delete colors[folder];
  saveFolderColors(colors);
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
  res.json(reports[idx]);
});

app.delete('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  let reports = loadReports();
  reports = reports.filter(r => r.id !== id);
  saveReports(reports);
  res.json({ success: true });
});

// Image endpoints
// Upload de imagem (base64)
app.post('/api/images/upload', (req, res) => {
  const { folder, filename, imageData, originalName } = req.body;
  
  if (!imageData || !originalName) {
    return res.status(400).json({ error: 'Dados da imagem não fornecidos' });
  }

  // Gerar nome único
  const ext = path.extname(originalName) || '.png';
  const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  
  // Criar pasta da pasta de origem
  const folderDir = path.join(IMAGES_DIR, folder.replace(/\//g, '_'));
  if (!fs.existsSync(folderDir)) {
    fs.mkdirSync(folderDir, { recursive: true });
  }

  // Decodificar base64 e salvar
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  const filePath = path.join(folderDir, uniqueName);
  
  try {
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    // Salvar referência no arquivo .md
    if (filename) {
      const mdPath = path.join(NOTION_PATH, folder, filename);
      if (fs.existsSync(mdPath)) {
        let content = fs.readFileSync(mdPath, 'utf8');
        const imgRef = `\n![${originalName}](/_images/${folder.replace(/\//g, '_')}/${uniqueName})`;
        
        // Verificar se já existe seção de imagens
        if (content.includes('## Imagens')) {
          content = content.replace('## Imagens\n', `## Imagens\n${imgRef}\n`);
        } else {
          content += `\n\n## Imagens\n${imgRef}`;
        }
        
        fs.writeFileSync(mdPath, content, 'utf8');
      }
    }
    
    res.json({ success: true, imagePath: `/_images/${folder.replace(/\//g, '_')}/${uniqueName}` });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
});

// Listar imagens de um arquivo
app.get('/api/images/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const folderDir = path.join(IMAGES_DIR, folder.replace(/\//g, '_'));
  
  if (!fs.existsSync(folderDir)) {
    return res.json([]);
  }
  
  // Procurar imagens que começam com o nome do arquivo ou estão referenciadas nele
  const files = fs.readdirSync(folderDir).filter(f => 
    f.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i)
  );
  
  // Filtrar apenas imagens referenciadas no arquivo
  const mdPath = path.join(NOTION_PATH, folder, filename);
  let referencedImages = [];
  
  if (fs.existsSync(mdPath)) {
    const content = fs.readFileSync(mdPath, 'utf8');
    const imgRegex = /\!\[.*?\]\(\/_images\/([^)]+)\)/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      referencedImages.push(match[1]);
    }
  }
  
  const images = files
    .filter(f => referencedImages.some(ref => ref.endsWith(f)))
    .map(f => ({
      name: f,
      path: `/_images/${folder.replace(/\//g, '_')}/${f}`,
      url: `/_images/${folder.replace(/\//g, '_')}/${f}`
    }));
  
  res.json(images);
});

// Deletar imagem
app.delete('/api/images/:folder/:imageName', (req, res) => {
  const { folder, imageName } = req.params;
  const filePath = path.join(IMAGES_DIR, folder.replace(/\//g, '_'), imageName);
  
  // Remover arquivo de imagem
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
      const imgRefRegex = new RegExp(`\\!\\[.*?\\]\\(/_images/${folder.replace(/\//g, '_')}/${imageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
      if (imgRefRegex.test(content)) {
        content = content.replace(imgRefRegex, '');
        // Remover seção "## Imagens" se estiver vazia
        content = content.replace(/## Imagens\n\n*/g, '');
        fs.writeFileSync(mdPath, content, 'utf8');
        break;
      }
    }
  }
  
  res.json({ success: true });
});

// Servir imagens estáticas
app.use('/_images', express.static(IMAGES_DIR));

app.listen(PORT, () => {
  console.log(`APS Assistance rodando em http://localhost:${PORT}`);
});
