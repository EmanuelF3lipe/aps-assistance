import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, setDbPath, closeDb } from './server/database.js';
import { formatContent } from './format-glpi-2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'aps-assistance.db');
  setDbPath(dbPath);
  const db = getDb();

  const all = db.prepare('SELECT id, content FROM files WHERE content LIKE ?').all('%Base de Conhecimento GLPI%');
  console.log(`Formatando ${all.length} arquivos importados do GLPI...`);

  const upd = db.prepare('UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  let changed = 0;
  for (const f of all) {
    const clean = formatContent(f.content || '');
    if (clean !== (f.content || '')) {
      upd.run(clean, f.id);
      changed++;
    }
  }
  console.log(`Registros atualizados: ${changed}`);

  // Validate: balanced markers across all GLPI files
  const bad = db.prepare('SELECT name, content FROM files WHERE content LIKE ?').all('%Base de Conhecimento GLPI%')
    .filter(f => {
      const starCount = ((f.content || '').match(/\*\*/g) || []).length;
      return starCount % 2 !== 0 || (f.content || '').includes('&') && /&[a-z]+;|&#\d+;/i.test(f.content || '');
    });
  console.log(`\nValidação: ${bad.length} arquivos com marcadores desbalanceados ou entidades restantes`);
  if (bad.length) for (const b of bad.slice(0, 8)) console.log('  -', b.name, '| stars:', ((b.content||'').match(/\*\*/g)||[]).length);

  closeDb();
  console.log('\nConcluído!');
}

main();