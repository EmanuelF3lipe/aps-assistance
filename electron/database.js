import { app } from 'electron';
import { setDbPath, getDb, closeDb } from '../server/database.js';
import path from 'path';

const DB_NAME = 'aps-assistance.db';

if (app && app.getPath) {
  setDbPath(path.join(app.getPath('userData'), DB_NAME));
}

export { getDb, closeDb };
