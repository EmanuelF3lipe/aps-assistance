import Database from 'better-sqlite3';

const src = new Database('C:/Projeto/Aps assistant/pas-interface/aps-assistance.bak-glpi-format.db');
const dst = new Database('C:/Projeto/Aps assistant/pas-interface/aps-assistance.db');

// Only restore the files table content for GLPI files
const srcFiles = src.prepare('SELECT id, name, content FROM files WHERE content LIKE ?').all('%Base de Conhecimento GLPI%');
const getDst = dst.prepare('SELECT id FROM files WHERE id = ?');
const updDst = dst.prepare('UPDATE files SET content = ?, name = ? WHERE id = ?');

let restored = 0;
for (const s of srcFiles) {
  let row = getDst.get(s.id);
  if (!row) continue;
  updDst.run(s.content, s.name, row.id);
  restored++;
}
console.log(`Restored content for ${restored} GLPI files from backup`);
src.close();
dst.close();