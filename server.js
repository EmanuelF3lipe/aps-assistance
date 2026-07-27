const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const NOTION_PATH = path.join(__dirname, '..', 'notion');
const FAVORITES_FILE = path.join(__dirname, 'favorites.json');

app.use(express.json());
app.use(express.static('public'));

// Carregar favoritos
function loadFavorites() {
    if (fs.existsSync(FAVORITES_FILE)) {
        return JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
    }
    return [];
}

function saveFavorites(favs) {
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favs, null, 2), 'utf8');
}

// Listar pastas (dinâmico)
app.get('/api/folders', (req, res) => {
    if (!fs.existsSync(NOTION_PATH)) {
        return res.json([]);
    }
    
    const folders = fs.readdirSync(NOTION_PATH)
        .filter(f => fs.statSync(path.join(NOTION_PATH, f)).isDirectory())
        .map(f => ({
            name: f,
            path: f
        }));
    
    res.json(folders);
});

// Criar pasta
app.post('/api/folders', (req, res) => {
    const { name } = req.body;
    const folderPath = path.join(NOTION_PATH, name);
    
    if (fs.existsSync(folderPath)) {
        return res.status(400).json({ error: 'Pasta já existe' });
    }
    
    fs.mkdirSync(folderPath, { recursive: true });
    res.json({ success: true });
});

// Renomear pasta
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

// Deletar pasta
app.delete('/api/folders/:name', (req, res) => {
    const { name } = req.params;
    const folderPath = path.join(NOTION_PATH, name);
    
    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: 'Pasta não encontrada' });
    }
    
    fs.rmSync(folderPath, { recursive: true });
    res.json({ success: true });
});

// Listar arquivos de uma pasta
app.get('/api/files/:folder', (req, res) => {
    const folder = req.params.folder;
    const folderPath = path.join(NOTION_PATH, folder);
    
    if (!fs.existsSync(folderPath)) {
        return res.json([]);
    }
    
    const files = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
            name: f.replace('.md', ''),
            filename: f,
            folder: folder
        }));
    
    res.json(files);
});

// Ler arquivo
app.get('/api/file/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const filePath = path.join(NOTION_PATH, folder, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo nao encontrado' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content, filename, folder });
});

// Criar arquivo
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

// Atualizar arquivo
app.put('/api/file/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const { content } = req.body;
    
    const filePath = path.join(NOTION_PATH, folder, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo nao encontrado' });
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true });
});

// Deletar arquivo
app.delete('/api/file/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    const filePath = path.join(NOTION_PATH, folder, filename);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    res.json({ success: true });
});

// Renomear arquivo (editar título)
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

// Mover arquivo para outra pasta
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

// Buscar em todos os arquivos
app.get('/api/search', (req, res) => {
    const query = req.query.q.toLowerCase();
    const results = [];
    
    const folders = ['scgwin', 'agilis', 'corpore', 'sgnfe/notas rejeitadas'];
    
    folders.forEach(folder => {
        const folderPath = path.join(NOTION_PATH, folder);
        if (!fs.existsSync(folderPath)) return;
        
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
        
        files.forEach(file => {
            const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
            if (content.toLowerCase().includes(query) || file.toLowerCase().includes(query)) {
                // Extrair tags do conteúdo
                const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
                const tags = tagMatch ? tagMatch[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()) : [];
                
                results.push({
                    name: file.replace('.md', ''),
                    filename: file,
                    folder: folder,
                    excerpt: content.substring(0, 150),
                    tags: tags
                });
            }
        });
    });
    
    res.json(results);
});

// Estatísticas
app.get('/api/stats', (req, res) => {
    const folders = ['scgwin', 'agilis', 'corpore', 'sgnfe/notas rejeitadas'];
    const stats = {
        total: 0,
        byFolder: {},
        recentFiles: [],
        tags: {}
    };
    
    folders.forEach(folder => {
        const folderPath = path.join(NOTION_PATH, folder);
        if (!fs.existsSync(folderPath)) {
            stats.byFolder[folder] = 0;
            return;
        }
        
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
        stats.byFolder[folder] = files.length;
        stats.total += files.length;
        
        // Arquivos recentes e tags
        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            const stat = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            
            stats.recentFiles.push({
                name: file.replace('.md', ''),
                filename: file,
                folder: folder,
                modified: stat.mtime
            });
            
            // Extrair tags
            const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
            if (tagMatch) {
                tagMatch[1].split('\n')
                    .filter(t => t.startsWith('-'))
                    .map(t => t.replace('- ', '').trim())
                    .forEach(tag => {
                        stats.tags[tag] = (stats.tags[tag] || 0) + 1;
                    });
            }
        });
    });
    
    // Ordenar por modificação
    stats.recentFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    stats.recentFiles = stats.recentFiles.slice(0, 10);
    
    res.json(stats);
});

// Favoritos
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

// Buscar por tags
app.get('/api/tags', (req, res) => {
    const tags = {};
    const folders = ['scgwin', 'agilis', 'corpore', 'sgnfe/notas rejeitadas'];
    
    folders.forEach(folder => {
        const folderPath = path.join(NOTION_PATH, folder);
        if (!fs.existsSync(folderPath)) return;
        
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
        
        files.forEach(file => {
            const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
            const tagMatch = content.match(/## Tags\n([\s\S]*?)$/);
            
            if (tagMatch) {
                tagMatch[1].split('\n')
                    .filter(t => t.startsWith('-'))
                    .map(t => t.replace('- ', '').trim())
                    .forEach(tag => {
                        if (!tags[tag]) tags[tag] = [];
                        tags[tag].push({ filename: file, folder });
                    });
            }
        });
    });
    
    res.json(tags);
});

app.listen(PORT, () => {
    console.log(`APS Assistance rodando em http://localhost:${PORT}`);
});