import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTION_PATH = path.join(__dirname, '..', '..', 'notion');
const TRASH_FOLDER = '_erros_nao_catalogados';

let bot = null;
let chatId = null;
const userSessions = new Map();
const indexMap = new Map();
let idCounter = 0;

function resetIndex() { indexMap.clear(); idCounter = 0; }
function regId(data) { const id = ++idCounter; indexMap.set(id, data); return id; }
function getData(id) { return indexMap.get(id); }

function getAllFolders() {
  if (!fs.existsSync(NOTION_PATH)) return [];
  return fs.readdirSync(NOTION_PATH)
    .filter(f => fs.statSync(path.join(NOTION_PATH, f)).isDirectory() && f !== TRASH_FOLDER && f !== '_images')
    .map(f => f);
}

function getFiles(folder) {
  const fp = path.join(NOTION_PATH, folder);
  if (!fs.existsSync(fp)) return [];
  return fs.readdirSync(fp).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}

function getFileContent(folder, filename) {
  const fp = path.join(NOTION_PATH, folder, filename + '.md');
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, 'utf8');
}

function getTags(content) {
  const m = content.match(/## Tags\n([\s\S]*?)$/);
  if (!m) return [];
  return m[1].split('\n').filter(t => t.startsWith('-')).map(t => t.replace('- ', '').trim()).filter(Boolean);
}

function searchFiles(q) {
  const results = [];
  const lower = q.toLowerCase();
  for (const folder of getAllFolders()) {
    for (const file of getFiles(folder)) {
      const c = getFileContent(folder, file);
      if (c && (file.toLowerCase().includes(lower) || c.toLowerCase().includes(lower))) {
        results.push({ folder, name: file });
      }
    }
  }
  return results;
}

function getAllTags() {
  const tags = {};
  for (const folder of getAllFolders()) {
    for (const file of getFiles(folder)) {
      const c = getFileContent(folder, file);
      if (c) getTags(c).forEach(t => { if (!tags[t]) tags[t] = []; tags[t].push({ folder, name: file }); });
    }
  }
  return tags;
}

function createFile(folder, filename, content) {
  const fp = path.join(NOTION_PATH, folder);
  if (!fs.existsSync(fp)) fs.mkdirSync(fp, { recursive: true });
  fs.writeFileSync(path.join(fp, filename + '.md'), content, 'utf8');
}

function buildPreview(content) {
  const sections = {};
  let header = [];
  let sec = 'header';
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) { sec = line.replace('## ', '').trim(); sections[sec] = []; }
    else if (sections[sec]) sections[sec].push(line);
    else header.push(line);
  }
  let r = header.join('\n').replace(/[#*]/g, '').trim();
  const sol = sections['Resolucao (passo a passo)'] || sections['Resolução (passo a passo)'];
  if (sol) { const t = sol.join('\n').replace(/[#*]/g, '').trim(); if (t) r += '\n\n📋 *Solução:*\n' + t; }
  const obs = sections['Observacao'] || sections['Observação'];
  if (obs) { const t = obs.join('\n').replace(/[#*]/g, '').trim(); if (t) r += '\n\n💡 *Obs:* ' + t; }
  const tags = getTags(content);
  if (tags.length > 0) r += '\n\n🏷️ *Tags:* ' + tags.map(t => '`' + t + '`').join(' ');
  return r.substring(0, 3000);
}

const EMOJI = { scgwin: '🖥️', agilis: '⚙️', corpore: '🏢', sgnfe: '📄', Maxsale: '🛒' };
const btn = (text, data) => ({ text, callback_data: data });

export function initBot(token) {
  if (!token) { console.log('   Telegram Bot: desativado'); return null; }
  if (bot) bot.stopPolling().catch(() => {});
  bot = new TelegramBot(token, { polling: true });
  chatId = null;
  console.log('   Telegram Bot: ativo');

  function mainMenu(cid) {
    resetIndex();
    bot.sendMessage(cid, '*🤖 APS Assistance*\nEscolha uma opcao:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [btn('📂 Pastas', 'm_pastas'), btn('🔍 Buscar', 'm_buscar')],
        [btn('➕ Criar Erro', 'm_criar'), btn('🏷️ Tags', 'm_tags')],
        [btn('❓ Ajuda', 'm_ajuda')]
      ]}
    });
  }

  function showFile(cid, folder, name) {
    const content = getFileContent(folder, name);
    if (!content) return bot.sendMessage(cid, '❌ Erro nao encontrado.');
    const preview = buildPreview(content);
    const shortName = name.length > 40 ? name.substring(0, 37) + '...' : name;
    bot.sendMessage(cid, '*📝 ' + shortName + '*\n📂 ' + folder + '\n\n' + preview, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [btn('📂 Ver na pasta', 'm_pastas')],
        [btn('◀️ Voltar', 'm_menu'), btn('🏠 Menu', 'm_menu')]
      ]}
    });
  }

  function showFolderFiles(cid, folder) {
    const files = getFiles(folder);
    if (!files.length) return bot.sendMessage(cid, '📭 Pasta *' + folder + '* vazia.', { parse_mode: 'Markdown' });
    resetIndex();
    const buttons = files.map(f => [btn('📝 ' + (f.length > 45 ? f.substring(0, 42) + '...' : f), 'vf' + regId({ t: 'file', folder, name: f }))]);
    buttons.push([btn('◀️ Voltar', 'm_pastas'), btn('🏠 Menu', 'm_menu')]);
    bot.sendMessage(cid, '*📂 ' + folder + '* (' + files.length + ' erros):', {
      parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons }
    });
  }

  bot.onText(/\/start/, (msg) => { chatId = msg.chat.id; mainMenu(chatId); });
  bot.onText(/\/ajudar|\/help/, (msg) => mainMenu(msg.chat.id));

  bot.on('callback_query', (query) => {
    const cid = query.message.chat.id;
    const data = query.data;
    bot.answerCallbackQuery(query.id);

    if (data === 'm_menu') return mainMenu(cid);

    if (data === 'm_pastas') {
      resetIndex();
      const folders = getAllFolders();
      if (!folders.length) return bot.sendMessage(cid, '📭 Nenhuma pasta.');
      const buttons = folders.map(f => {
        const id = regId({ t: 'folder', name: f });
        const count = getFiles(f).length;
        const em = EMOJI[f] || '📁';
        return [btn(em + ' ' + f + ' (' + count + ')', 'vf' + id)];
      });
      buttons.push([btn('◀️ Voltar', 'm_menu')]);
      bot.sendMessage(cid, '*📂 Pastas:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    }

    if (data === 'm_buscar') {
      userSessions.set(cid, { step: 'buscar' });
      bot.sendMessage(cid, '*🔍 Digite o que deseja buscar:*', { parse_mode: 'Markdown' });
    }

    if (data === 'm_tags') {
      resetIndex();
      const tags = getAllTags();
      const tagNames = Object.keys(tags).sort();
      if (!tagNames.length) return bot.sendMessage(cid, '🏷️ Nenhuma tag.');
      const buttons = tagNames.map(t => [btn('🏷️ ' + t + ' (' + tags[t].length + ')', 'vt' + regId({ t: 'tag', name: t }))]);
      buttons.push([btn('◀️ Voltar', 'm_menu')]);
      bot.sendMessage(cid, '*🏷️ Tags:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    }

    if (data === 'm_criar') {
      const folders = getAllFolders();
      if (!folders.length) return bot.sendMessage(cid, '📭 Crie uma pasta no app primeiro.');
      userSessions.set(cid, { step: 'create_folder', data: {} });
      resetIndex();
      const buttons = folders.map(f => [btn((EMOJI[f]||'📁') + ' ' + f, 'cf' + regId({ t: 'create_folder', name: f }))]);
      buttons.push([btn('❌ Cancelar', 'm_menu')]);
      bot.sendMessage(cid, '*➕ Criar Erro*\nEscolha a pasta:', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    }

    if (data === 'm_ajuda') {
      bot.sendMessage(cid, '*❓ Como usar:*\n\n📂 *Pastas* - Navegar pastas e erros\n🔍 *Buscar* - Buscar por palavra-chave\n➕ *Criar* - Criar novo erro\n🏷️ *Tags* - Ver erros por tag\n\nClique nos botoes para navegar!', { parse_mode: 'Markdown' });
    }

    if (data.startsWith('vf')) {
      const id = parseInt(data.substring(2));
      const item = getData(id);
      if (!item) return bot.sendMessage(cid, '⚠️ Sessao expirada. Use /start');
      if (item.t === 'folder') return showFolderFiles(cid, item.name);
      if (item.t === 'file') return showFile(cid, item.folder, item.name);
      if (item.t === 'search') return showFile(cid, item.folder, item.name);
    }

    if (data.startsWith('vt')) {
      const id = parseInt(data.substring(2));
      const item = getData(id);
      if (!item) return bot.sendMessage(cid, '⚠️ Sessao expirada. Use /start');
      const tags = getAllTags();
      const files = tags[item.name] || [];
      if (!files.length) return bot.sendMessage(cid, '📭 Nenhum arquivo com essa tag.');
      resetIndex();
      const buttons = files.map(f => [btn('📝 ' + (f.name.length > 45 ? f.name.substring(0, 42) + '...' : f.name), 'vf' + regId({ t: 'file', folder: f.folder, name: f.name }))]);
      buttons.push([btn('◀️ Voltar', 'm_tags'), btn('🏠 Menu', 'm_menu')]);
      bot.sendMessage(cid, '*🏷️ ' + item.name + '* (' + files.length + '):', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('cf')) {
      const id = parseInt(data.substring(2));
      const item = getData(id);
      if (!item) return bot.sendMessage(cid, '⚠️ Sessao expirada. Use /start');
      const session = userSessions.get(cid) || { data: {} };
      session.step = 'create_name';
      session.data.folder = item.name;
      userSessions.set(cid, session);
      bot.sendMessage(cid, '*➕ Criar em ' + (EMOJI[item.name]||'📁') + ' ' + item.name + '*\nQual o titulo do erro?', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[btn('❌ Cancelar', 'm_menu')]] }
      });
    }
  });

  bot.on('message', (msg) => {
    const cid = msg.chat.id;
    const text = msg.text?.trim();
    if (!text || text.startsWith('/')) return;
    const session = userSessions.get(cid);
    if (!session) return;

    if (session.step === 'buscar') {
      userSessions.delete(cid);
      const results = searchFiles(text);
      if (!results.length) {
        return bot.sendMessage(cid, '🔍 Nenhum resultado para *' + text + '*', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[btn('◀️ Voltar', 'm_menu')]] }
        });
      }
      resetIndex();
      const limited = results.slice(0, 8);
      const buttons = limited.map(r => [btn('📝 ' + (r.name.length > 35 ? r.name.substring(0, 32) + '...' : r.name) + ' (' + r.folder + ')', 'vf' + regId({ t: 'search', folder: r.folder, name: r.name }))]);
      buttons.push([btn('◀️ Voltar', 'm_menu')]);
      bot.sendMessage(cid, '*🔍 Resultados para "' + text + '"* (' + results.length + '):', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
      return;
    }

    if (session.step === 'create_name') {
      session.data.name = text;
      session.step = 'create_desc';
      bot.sendMessage(cid, '*Passo 2/2:* Descreva o erro e a solucao:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[btn('❌ Cancelar', 'm_menu')]] }
      });
      return;
    }

    if (session.step === 'create_desc') {
      const { folder, name } = session.data;
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR');
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const content = '# ' + name + '\n\n**Criado em:** ' + date + ' ' + time + '\n**Sistema:** \n**Contexto / Quando acontece:** \n\n## Resolucao (passo a passo)\n\n' + text + '\n\n## Observacao\n\n\n\n## Tags\n\n- \n\n---\n';
      createFile(folder, name, content);
      userSessions.delete(cid);
      bot.sendMessage(cid, '*✅ Erro criado!*\n\n📝 ' + name + '\n📂 ' + folder, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [btn('📂 Ver em ' + folder, 'm_pastas')],
          [btn('🏠 Menu', 'm_menu')]
        ]}
      });
    }
  });

  bot.onText(/\/stop/, (msg) => {
    const cid = msg.chat.id;
    bot.sendMessage(cid, '🛑 Bot desativado. Para reativar, envie /start');
    bot.stopPolling();
    bot = null;
  });

  return bot;
}

export function sendNotification(message) {
  if (bot && chatId) bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }).catch(() => {});
}

export function stopBot() {
  if (bot) {
    bot.stopPolling().catch(() => {});
    bot = null;
    console.log('   Telegram Bot: parado');
  }
}

export function getBot() { return bot; }
