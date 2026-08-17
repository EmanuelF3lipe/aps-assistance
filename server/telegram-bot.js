// ============================================================================
// APS ASSISTANCE - Bot do Telegram
// ----------------------------------------------------------------------------
// Implementa um bot com teclados inline para:
//   - Navegar pastas e erros catalogados (.md em /notion)
//   - Buscar erros por palavra-chave e listar por tags
//   - Criar novos erros via wizard em etapas (pasta -> titulo -> descricao)
//   - Receber notificacoes de eventos do servidor (novo/alterado/excluido)
// ============================================================================
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTION_PATH = path.join(__dirname, '..', '..', 'notion');
const TRASH_FOLDER = '_erros_nao_catalogados';

// Estado do bot: instancia, chat ativo, sessoes do wizard de criacao
// e um "index" de botoes (mapeia IDs curtos para pastas/arquivos/tags)
let bot = null;
let chatId = null;
const userSessions = new Map();
const indexMap = new Map();
const pendingMessages = [];
let idCounter = 0;

// Registro e resolucao de IDs dos botoes inline (reiniciado a cada navegacao)
function resetIndex() { indexMap.clear(); idCounter = 0; }
function regId(data) { const id = ++idCounter; indexMap.set(id, data); return id; }
function getData(id) { return indexMap.get(id); }

// Acessos ao armazenamento: listar pastas, arquivos .md, ler conteudo e tags
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

// Busca por palavra-chave no nome e conteudo dos arquivos (todas as pastas)
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

// Agrupa arquivos por tag, extraindo a secao "## Tags" do markdown
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

// Cria o arquivo .md do erro (cria a pasta caso nao exista)
function createFile(folder, filename, content) {
  const fp = path.join(NOTION_PATH, folder);
  if (!fs.existsSync(fp)) fs.mkdirSync(fp, { recursive: true });
  fs.writeFileSync(path.join(fp, filename + '.md'), content, 'utf8');
}

// Monta uma "previa" legivel do markdown para exibicao no Telegram:
// cabeçalho, secao de resolucao, observacao e tags (limite de 3000 chars)
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
  if (sol) { const t = sol.join('\n').replace(/[#*]/g, '').trim(); if (t) r += '\n\nSolucao:\n' + t; }
  const obs = sections['Observacao'] || sections['Observação'];
  if (obs) { const t = obs.join('\n').replace(/[#*]/g, '').trim(); if (t) r += '\n\nObs: ' + t; }
  const tags = getTags(content);
  if (tags.length > 0) r += '\n\nTags: ' + tags.map(t => '`' + t + '`').join(' ');
  return r.substring(0, 3000);
}

// Emojis por sistema conhecido e helper para montar botoes inline
const EMOJI = { scgwin: '🖥️', agilis: '⚙️', corpore: '🏢', sgnfe: '📄', Maxsale: '🛒' };
const btn = (text, data) => ({ text, callback_data: data });

// ===== INICIALIZACAO DO BOT =====
// Cria a instancia com polling e registra todos os comandos e callbacks
export function initBot(token) {
  if (!token) { console.log('   Telegram Bot: desativado'); return null; }
  if (bot) { try { bot.stopPolling(); } catch (e) {} }
  bot = new TelegramBot(token, { polling: true });
  chatId = null;
  console.log('   Telegram Bot: ativo');

  // /start: registra o chat para notificacoes, libera mensagens pendentes
  // e mostra o menu principal com teclado inline
  bot.onText(/\/start(.*)/, (msg, match) => {
    const cid = msg.chat.id;
    chatId = cid;
    userSessions.delete(cid);
    resetIndex();

    while (pendingMessages.length > 0) {
      const pending = pendingMessages.shift();
      bot.sendMessage(chatId, pending, { parse_mode: 'Markdown' }).catch(() => {});
    }

    bot.sendMessage(cid, '*🤖 APS Assistance*\nEscolha uma opcao:', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [btn('📂 Pastas', 'm_pastas'), btn('🔍 Buscar', 'm_buscar')],
        [btn('➕ Criar Erro', 'm_criar'), btn('🏷️ Tags', 'm_tags')],
        [btn('❓ Ajuda', 'm_ajuda')]
      ]}
    }).catch(err => console.log('Erro /start:', err.message));
  });

  // /ajuda e /help: instrucoes de uso do bot
  bot.onText(/\/ajuda|\/help/, (msg) => {
    const cid = msg.chat.id;
    bot.sendMessage(cid, '*❓ Como usar:*\n\n📂 *Pastas* - Navegar pastas e erros\n🔍 *Buscar* - Buscar por palavra-chave\n➕ *Criar* - Criar novo erro\n🏷️ *Tags* - Ver erros por tag\n\nClique nos botoes para navegar!', { parse_mode: 'Markdown' });
  });

  // /stop: desativa o bot (para o polling e libera a instancia)
  bot.onText(/\/stop/, (msg) => {
    const cid = msg.chat.id;
    bot.sendMessage(cid, '🛑 Bot desativado. Para reativar, envie /start');
    bot.stopPolling();
    bot = null;
  });

  // ===== TECLADOS INLINE (callback_query) =====
  // Trata os cliques nos botoes: menu, pastas (vf*), tags (vt*),
  // criacao de erro (cf*). Os prefixos apontam para o indexMap
  bot.on('callback_query', (query) => {
    const cid = query.message.chat.id;
    const data = query.data;
    bot.answerCallbackQuery(query.id).catch(() => {});

    // m_menu: volta ao menu principal (limpa a navegacao atual)
    if (data === 'm_menu') {
      resetIndex();
      userSessions.delete(cid);
      return bot.sendMessage(cid, '*🤖 APS Assistance*\nEscolha uma opcao:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [btn('📂 Pastas', 'm_pastas'), btn('🔍 Buscar', 'm_buscar')],
          [btn('➕ Criar Erro', 'm_criar'), btn('🏷️ Tags', 'm_tags')],
          [btn('❓ Ajuda', 'm_ajuda')]
        ]}
      });
    }

    // m_pastas: lista as pastas com contagem de erros, cada uma com botao proprio
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

    // m_buscar: inicia o wizard de busca (aguarda texto na proxima mensagem)
    if (data === 'm_buscar') {
      userSessions.set(cid, { step: 'buscar' });
      bot.sendMessage(cid, '*🔍 Digite o que deseja buscar:*', { parse_mode: 'Markdown' });
    }

    // m_tags: lista as tags disponiveis com a quantidade de erros de cada uma
    if (data === 'm_tags') {
      resetIndex();
      const tags = getAllTags();
      const tagNames = Object.keys(tags).sort();
      if (!tagNames.length) return bot.sendMessage(cid, '🏷️ Nenhuma tag.');
      const buttons = tagNames.map(t => [btn('🏷️ ' + t + ' (' + tags[t].length + ')', 'vt' + regId({ t: 'tag', name: t }))]);
      buttons.push([btn('◀️ Voltar', 'm_menu')]);
      bot.sendMessage(cid, '*🏷️ Tags:*', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    }

    // m_criar: inicio do wizard de criacao - primeiro passo escolhe a pasta
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

    // vf*: navegacao de pasta (lista arquivos) ou visualizacao do erro
// (previa formatada) a partir dos dados registrados no indexMap
    if (data.startsWith('vf')) {
      const id = parseInt(data.substring(2));
      const item = getData(id);
      if (!item) return bot.sendMessage(cid, '⚠️ Sessao expirada. Use /start');
      if (item.t === 'folder') {
        resetIndex();
        const files = getFiles(item.name);
        if (!files.length) return bot.sendMessage(cid, '📭 Pasta *' + item.name + '* vazia.', { parse_mode: 'Markdown' });
        const buttons = files.map(f => [btn('📝 ' + (f.length > 45 ? f.substring(0, 42) + '...' : f), 'vf' + regId({ t: 'file', folder: item.name, name: f }))]);
        buttons.push([btn('◀️ Voltar', 'm_pastas'), btn('🏠 Menu', 'm_menu')]);
        bot.sendMessage(cid, '*📂 ' + item.name + '* (' + files.length + ' erros):', {
          parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons }
        });
      }
      if (item.t === 'file' || item.t === 'search') {
        const content = getFileContent(item.folder, item.name);
        if (!content) return bot.sendMessage(cid, '❌ Erro nao encontrado.');
        const preview = buildPreview(content);
        const shortName = item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name;
        bot.sendMessage(cid, '*📝 ' + shortName + '*\n📂 ' + item.folder + '\n\n' + preview, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [btn('📂 Ver na pasta', 'm_pastas')],
            [btn('◀️ Voltar', 'm_menu'), btn('🏠 Menu', 'm_menu')]
          ]}
        });
      }
    }

    // vt*: cliques em uma tag - lista os erros que possuem aquela tag
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

    // cf*: pasta escolhida no wizard de criacao - avanca para o passo 1/2
// (titulo), guardando a pasta na sessao do usuario
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

    // ===== MENSAGENS DE TEXTO (wizard de criacao e busca) =====
  // So processa mensagens quando o usuario esta em uma sessao ativa;
  // direciona a entrada conforme o passo atual (buscar, create_name, create_desc)
  bot.on('message', (msg) => {
    const cid = msg.chat.id;
    const text = msg.text?.trim();
    if (!text) return;

    const session = userSessions.get(cid);
    if (!session) return;

    // Passo de busca: executa a pesquisa e mostra ate 8 resultados como botoes
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

    // Passo create_name: guarda o titulo e pede descricao (passo 2/2)
    if (session.step === 'create_name') {
      session.data.name = text;
      session.step = 'create_desc';
      bot.sendMessage(cid, '*Passo 2/2:* Descreva o erro e a solucao:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[btn('❌ Cancelar', 'm_menu')]] }
      });
      return;
    }

    // Passo create_desc: monta o markdown completo do erro, salva o arquivo,
// encerra a sessao e confirma ao usuario
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

    // Tratamento de erros do polling (conflitos de token, rede, etc.)
  bot.on('polling_error', (err) => {
    console.log('   Telegram polling error:', err.message);
  });

  return bot;
}

// ===== NOTIFICACOES =====
// Envia mensagem ao chat registrado via /start; se ainda nao houver chat,
// acumula em pendingMessages para entrega no proximo /start
export function sendNotification(message) {
  if (!bot) return;
  if (chatId) {
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }).catch(() => {});
  } else {
    pendingMessages.push(message);
  }
}

// Para o polling e libera a instancia do bot, limpando estado e fila
export function stopBot() {
  if (bot) {
    try {
      bot.stopPolling().catch(() => {});
    } catch (e) {}
    bot = null;
    chatId = null;
    pendingMessages.length = 0;
    console.log('   Telegram Bot: parado');
  }
}

// Acesso a instancia atual (usado pelo servidor para diagnostico)
export function getBot() { return bot; }
