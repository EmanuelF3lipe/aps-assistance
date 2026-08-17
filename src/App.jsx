/**
 * App.jsx - Componente principal do APS Assistance.
 * Orquestra todos os módulos (aps / diario / ferramentas), estados globais,
 * views (dashboard / erros / relatorios), atalhos de teclado, socket.io e modais.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { io } from 'socket.io-client'
import { api } from './services/api'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import FilePanel from './components/FilePanel'
import Dashboard from './components/Dashboard'
import Toast from './components/Toast'
import NewFolderModal from './components/Modals/NewFolderModal'
import RenameFolderModal from './components/Modals/RenameFolderModal'
import TrashPanel from './components/TrashPanel'
import TagsPanel from './components/TagsPanel'
import RelatoriosPanel from './components/RelatoriosPanel'
import AdvancedSearchPanel from './components/AdvancedSearchPanel'
import DiarioPanel from './components/DiarioPanel'
import ToolboxPanel from './components/ToolboxPanel'
import SplashScreen from './components/SplashScreen'
import PublicForm from './components/PublicForm'
import ErrorPopup from './components/ErrorPopup'
import { FiX, FiCommand, FiEdit } from 'react-icons/fi'

export default function App() {
  // ===== ESTADOS GLOBAIS =====
  // Dados principais: pastas, arquivos e favoritos
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [favorites, setFavorites] = useState([])
  // Estado que controla qual pasta está selecionada
  const [currentFolder, setCurrentFolder] = useState('')
  // Busca, notificações (toast) e controle dos modais (novo arquivo/pasta, renomear, mover)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [modals, setModals] = useState({ newFile: false, newFolder: false, renameFolder: false, moveFile: false })
  const [selectedFolderForRename, setSelectedFolderForRename] = useState('')
  // Controle de painéis e da view principal (dashboard / erros / relatorios)
  const [showTrash, setShowTrash] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [mainView, setMainView] = useState('dashboard')
  const [folderRefreshTrigger, setFolderRefreshTrigger] = useState(0)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  // Popup do erro em análise (aberto ao clicar em um erro)
  const [errorPopup, setErrorPopup] = useState({ show: false, file: null })
  // Preferências de UI: tema (dark/light), sidebar no mobile e modal de atalhos
  const [theme, setTheme] = useState(() => localStorage.getItem('aps-theme') || 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  // Critério de ordenação da lista de erros (nome / pasta / recente)
  const [sortBy, setSortBy] = useState('name')
  // Modulo ativo: null = APS, 'diario' ou 'ferramentas'
  const [currentModule, setCurrentModule] = useState(null)
  // Seleção em lote, formulário de novo erro e todas as tags existentes
  const [selectedFiles, setSelectedFiles] = useState([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [allTags, setAllTags] = useState([])

  // ===== EFEITOS E MEMO =====
  // Aplica o tema (dark/light) ao documento e persiste a escolha no localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('aps-theme', theme)
  }, [theme])

  // Lista de arquivos ordenada conforme o critério escolhido (recriada quando muda)
  const sortedFiles = useMemo(() => {
    const arr = [...files]
    if (sortBy === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'folder') arr.sort((a, b) => (a.folder || '').localeCompare(b.folder || ''))
    else if (sortBy === 'recent') arr.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
    return arr
  }, [files, sortBy])

  // Exibe uma notificação temporária (toast) por 2,5 segundos
  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500)
  }, [])

  // ===== CARREGAMENTO DE DADOS =====
  // Busca as pastas no servidor e atualiza o estado
  const loadFolders = useCallback(async () => {
    const data = await api.getFolders()
    setFolders(data)
  }, [])

  // Carrega os erros favoritados
  const loadFavorites = useCallback(async () => {
    const data = await api.getFavorites()
    setFavorites(data)
  }, [])

  // Carrega os arquivos de uma pasta
  const loadFiles = useCallback(async (folder) => {
    const data = await api.getFiles(folder)
    setFiles(data)
  }, [])

  // Busca todas as tags cadastradas para o formulário de novo erro
  const loadAllTags = useCallback(async () => {
    try {
      const res = await api.getTags()
      setAllTags(Object.keys(res || {}))
    } catch (e) {
      setAllTags([])
    }
  }, [])

  // Seleciona uma pasta, muda para a view de erros e carrega seus arquivos
  const handleSelectFolder = useCallback(async (folder) => {
    setCurrentFolder(folder)
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    setSelectedFiles([])
    await loadFiles(folder)
    setSidebarOpen(false)
  }, [loadFiles])

  // Abre o popup de detalhes do erro clicado
  const handleErrorPopup = useCallback(async (file) => {
    if (!file?.folder) return
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    setErrorPopup({ show: true, file })
  }, [])

  // Fecha o popup de erro e recarrega a lista de arquivos/pastas
  const handleCloseErrorPopup = useCallback(async () => {
    setErrorPopup({ show: false, file: null })
    if (currentFolder && !currentFolder.startsWith('[search]')) {
      await loadFiles(currentFolder)
    }
    await loadFolders()
  }, [currentFolder, loadFiles, loadFolders])

  // ===== BUSCA =====
  // Busca por palavra-chave; quando ativa, cria uma "pasta virtual" [search]
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query)
    if (!query) {
      if (currentFolder && !currentFolder.startsWith('[search]')) {
        await loadFiles(currentFolder)
      } else {
        setFiles([])
        setCurrentFolder('')
      }
      return
    }
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    setCurrentFolder(`[search] "${query}"`)
    const results = await api.search(query)
    setFiles(results.map(r => ({ ...r, name: r.filename.replace('.md', '') })))
  }, [currentFolder, loadFiles])

  // Limpa a busca e restaura a pasta real anterior
  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    if (currentFolder && currentFolder.startsWith('[search]')) {
      setFiles([])
      setCurrentFolder('')
    }
  }, [currentFolder])

  // Busca avançada com filtros combinados (texto, pasta, tags e período)
  const handleAdvancedSearch = useCallback(async (filters) => {
    const parts = []
    if (filters.query) parts.push(`"${filters.query}"`)
    if (filters.folder) parts.push(filters.folder)
    if (filters.tags) parts.push(`tags: ${filters.tags}`)
    if (filters.dateFrom || filters.dateTo) parts.push(`${filters.dateFrom || '...'} ate ${filters.dateTo || '...'}`)
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    setShowAdvancedSearch(false)
    setCurrentFolder(`[search] Avancada: ${parts.join(', ') || 'Todos'}`)
    const results = await api.advancedSearch(filters)
    setFiles(results.map(r => ({ ...r, name: r.filename.replace('.md', '') })))
  }, [])

  // Adiciona ou remove um erro dos favoritos conforme o estado atual
  const handleToggleFavorite = useCallback(async (filename, folder) => {
    const existing = favorites.find(f => f.filename === filename && f.folder === folder)
    if (existing) {
      await api.removeFavorite(filename, folder)
      showToast('Removido dos favoritos')
    } else {
      await api.addFavorite(filename, folder)
      showToast('Adicionado aos favoritos!')
    }
    await loadFavorites()
  }, [favorites, loadFavorites, showToast])

  // ===== CRUD DE PASTAS =====
  // Cria uma nova pasta no servidor e atualiza a lista
  const handleCreateFolder = useCallback(async (name) => {
    const result = await api.createFolder(name)
    if (result.error) { showToast(result.error, 'error'); return }
    setModals(prev => ({ ...prev, newFolder: false }))
    await loadFolders()
    showToast('Pasta criada!')
  }, [loadFolders, showToast])

  // Renomeia a pasta selecionada
  const handleRenameFolder = useCallback(async (newName) => {
    if (!newName || newName === selectedFolderForRename) {
      setModals(prev => ({ ...prev, renameFolder: false }))
      return
    }
    const result = await api.renameFolder(selectedFolderForRename, newName)
    if (result.error) { showToast(result.error, 'error'); return }
    setModals(prev => ({ ...prev, renameFolder: false }))
    await loadFolders()
    showToast('Pasta renomeada!')
  }, [selectedFolderForRename, loadFolders, showToast])

  // Exclui uma pasta, movendo seus arquivos para a lixeira
  const handleDeleteFolder = useCallback(async (folderPath) => {
    if (!confirm(`Excluir a pasta "${folderPath}"? Arquivos serao movidos para lixeira.`)) return
    const result = await api.deleteFolder(folderPath)
    showToast(result.movedFiles > 0 ? `Pasta excluida! ${result.movedFiles} arquivo(s) movido(s)` : 'Pasta excluida!')
    await loadFolders()
  }, [loadFolders, showToast])

  // ===== LIXEIRA =====
  // Restaura um erro da lixeira e atualiza pastas, lixo e arquivos
  const handleRestoreFromTrash = useCallback(async (filename) => {
    await api.restoreFromTrash(filename)
    await loadFolders()
    setFolderRefreshTrigger(prev => prev + 1)
    if (currentFolder && !currentFolder.startsWith('[search]') && mainView === 'erros') {
      await loadFiles(currentFolder)
    }
    showToast('Arquivo restaurado!')
  }, [loadFolders, loadFiles, currentFolder, mainView, showToast])

  // Exclui um erro definitivamente (sem chance de recuperação)
  const handleDeleteFromTrash = useCallback(async (filename) => {
    if (!confirm('Excluir permanentemente?')) return
    await api.deleteFromTrash(filename)
    showToast('Excluido permanentemente!')
  }, [showToast])

  // Esvazia completamente a lixeira
  const handleEmptyTrash = useCallback(async () => {
    if (!confirm('Esvaziar a lixeira?')) return
    await api.emptyTrash()
    showToast('Lixeira esvaziada!')
  }, [showToast])

  // Move o erro aberto no popup para outra pasta
  const handleMoveFile = useCallback(async (targetFolder) => {
    const file = errorPopup.file
    if (!file || !targetFolder || targetFolder === (file.folder || currentFolder)) return
    const filename = file.filename || (file.name ? file.name + '.md' : '')
    if (!filename) return
    const sourceFolder = file.folder || currentFolder
    await api.moveFile(sourceFolder, filename, targetFolder)
    setModals(prev => ({ ...prev, moveFile: false }))
    await loadFiles(currentFolder)
    await loadFolders()
    setFolderRefreshTrigger(prev => prev + 1)
    handleCloseErrorPopup()
    showToast('Arquivo movido!')
  }, [currentFolder, errorPopup.file, loadFiles, loadFolders, handleCloseErrorPopup, showToast])

  // Gera e baixa um arquivo CSV com nome e pasta de cada erro listado
  const handleExportCSV = useCallback(() => {
    const data = files.map(f => `${f.name};${f.folder}`).join('\n')
    const blob = new Blob([`Nome;Pasta\n${data}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `erros_${currentFolder || 'todos'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV exportado!')
  }, [files, currentFolder, showToast])

  // ===== AÇÕES EM LOTE =====
  // Exclui todos os erros marcados na seleção
  const handleBatchDelete = useCallback(async () => {
    if (!confirm(`Excluir ${selectedFiles.length} erro(s)?`)) return
    for (const f of selectedFiles) {
      await api.deleteFile(f.folder, f.filename || f.name + '.md')
    }
    setSelectedFiles([])
    await loadFiles(currentFolder)
    await loadFolders()
    showToast(`${selectedFiles.length} arquivo(s) excluido(s)!`)
  }, [selectedFiles, currentFolder, loadFiles, loadFolders, showToast])

  // Move vários erros selecionados para outra pasta de uma só vez
  const handleBatchMove = useCallback(async (targetFolder) => {
    if (!targetFolder) return
    for (const f of selectedFiles) {
      await api.moveFile(f.folder, f.filename || f.name + '.md', targetFolder)
    }
    setSelectedFiles([])
    await loadFiles(currentFolder)
    await loadFolders()
    setFolderRefreshTrigger(prev => prev + 1)
    showToast(`${selectedFiles.length} arquivo(s) movido(s)!`)
  }, [selectedFiles, currentFolder, loadFiles, loadFolders, showToast])

  // ===== EFEITOS =====
  // Carregamento inicial: busca pastas e favoritos ao montar o aplicativo
  useEffect(() => {
    loadFolders()
    loadFavorites()
  }, [loadFolders, loadFavorites])

  // Ao abrir o formulário de novo erro, carrega as tags disponíveis
  useEffect(() => {
    if (showNewForm) loadAllTags()
  }, [showNewForm, loadAllTags])

  // Refs espelhadas para o socket sempre usar os valores atuais (evita closures antigas)
  const currentFolderRef = useRef(currentFolder)
  currentFolderRef.current = currentFolder
  const mainViewRef = useRef(mainView)
  mainViewRef.current = mainView

  // ===== SOCKET.IO =====
  // Escuta o evento 'data-changed' do servidor e recarrega os dados em tempo real
  useEffect(() => {
    const socket = io()
    socket.on('data-changed', () => {
      loadFolders()
      loadFavorites()
      if (currentFolderRef.current && !currentFolderRef.current.startsWith('[search]') && mainViewRef.current === 'erros') {
        loadFiles(currentFolderRef.current)
      }
    })
    return () => socket.disconnect()
  }, [loadFolders, loadFavorites, loadFiles])

  // ===== ATALHOS DE TECLADO =====
  // Ctrl+K foca a busca, Ctrl+N abre novo erro, Esc fecha painéis e Ctrl+/ mostra os atalhos
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput')?.focus() }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowNewForm(true) }
      if (e.key === 'Escape') {
        if (showNewForm) setShowNewForm(false)
        else if (errorPopup.show) handleCloseErrorPopup()
        else if (showAdvancedSearch) setShowAdvancedSearch(false)
        else if (showShortcuts) setShowShortcuts(false)
      }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowShortcuts(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showNewForm, errorPopup.show, showAdvancedSearch, showShortcuts, handleCloseErrorPopup])

  // Volta para a tela inicial (splash), resetando o estado da interface
  const handleGoHome = useCallback(() => {
    setShowSplash(true)
    setCurrentModule(null)
    setSidebarOpen(false)
    setShowNewForm(false)
    setErrorPopup({ show: false, file: null })
    setSelectedFiles([])
  }, [])

  // ===== RENDERIZAÇÃO =====
  // Com o splash ativo, mostra somente a tela de seleção de módulo
  if (showSplash) {
    return <SplashScreen onEnter={(moduleId) => { setCurrentModule(moduleId); setShowSplash(false) }} />
  }

  return (
    <div className="app" data-module={currentModule || 'aps'}>
      {/* ==== CABEÇALHO ==== */}
      {/* Recebe todos os handlers de busca, views, tema e navegação */}
      <Header
        currentModule={currentModule}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onNewFile={() => setShowNewForm(true)}
        mainView={mainView}
        onSwitchView={() => setMainView(mainView === 'erros' ? 'dashboard' : 'erros')}
        onShowTags={() => { setMainView('erros'); setShowTrash(false); setShowTags(true) }}
        onShowRelatorios={() => { setMainView('relatorios'); setShowTags(false); setShowTrash(false) }}
        onShowDashboard={() => { setMainView('dashboard'); setShowTags(false); setShowTrash(false) }}
        onSearchByTag={(tag) => { setSearchQuery(tag); handleSearch(tag); setShowTags(false) }}
        onShowAdvancedSearch={() => setShowAdvancedSearch(true)}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        theme={theme}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onGoHome={handleGoHome}
      />

      {/* Overlay do menu lateral no mobile: clique fecha a sidebar */}
      {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}

      {/* ==== SWITCH DE MÓDULOS E VIEWS ==== */}
      {/* Modulos diario e ferramentas renderizam em tela cheia; no modulo APS alternam lixeira, erros, tags, relatorios e dashboard */}
      {currentModule === 'diario' ? (
        <div className="dashboard-full"><DiarioPanel /></div>
      ) : currentModule === 'ferramentas' ? (
        <div className="dashboard-full"><ToolboxPanel /></div>
      ) : showTrash ? (
        <div className="dashboard-full">
          <TrashPanel
            onRestore={handleRestoreFromTrash}
            onDelete={handleDeleteFromTrash}
            onEmpty={handleEmptyTrash}
            onBack={() => setShowTrash(false)}
          />
        </div>
      ) : mainView === 'erros' && !showTags ? (
        <div className="workspace">
          {/* Painel lateral: pastas, favoritos, lixeira e ações */}
          <Sidebar
            folders={folders}
            favorites={favorites}
            currentFolder={currentFolder}
            onSelectFolder={handleSelectFolder}
            onSelectFile={handleErrorPopup}
            onNewFolder={() => setModals(prev => ({ ...prev, newFolder: true }))}
            onRenameFolder={(path) => { setSelectedFolderForRename(path); setModals(prev => ({ ...prev, renameFolder: true })) }}
            onDeleteFolder={handleDeleteFolder}
            onToggleFavorite={handleToggleFavorite}
            onShowTrash={() => setShowTrash(true)}
            showTrash={showTrash}
            refreshTrigger={folderRefreshTrigger}
            className={sidebarOpen ? 'open' : ''}
          />

          {/* Painel central: lista de erros da pasta, ordenação e ações em lote */}
          <FilePanel
            currentFolder={currentFolder}
            files={sortedFiles}
            onSelectFile={handleErrorPopup}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
        onNewFile={() => setShowNewForm(true)}
            sortBy={sortBy}
            onSortChange={setSortBy}
            selectedFiles={selectedFiles}
            onSelectBatch={setSelectedFiles}
            onExportCSV={handleExportCSV}
            onBatchDelete={handleBatchDelete}
            onBatchMove={handleBatchMove}
            folders={folders}
          />

          {/* Painel de conteúdo reservado para os detalhes do erro selecionado */}
          <div className="content-panel">
            <div className="empty-content-placeholder">
              <span className="empty-content-icon"><FiEdit size={48} /></span>
              <p>Selecione um erro para visualizar</p>
            </div>
          </div>
        </div>
      ) : showTags ? (
        <div className="dashboard-full"><TagsPanel onSelectFile={handleErrorPopup} /></div>
      ) : mainView === 'relatorios' ? (
        <div className="dashboard-full"><RelatoriosPanel /></div>
      ) : (
        <div className="dashboard-full"><Dashboard onSelectFile={handleErrorPopup} /></div>
      )}

      {/* ==== MODAIS E POPUPS ==== */}
      {/* Formulário público de novo erro */}
      {showNewForm && (
        <PublicForm
          key="new-error-form"
          onClose={() => setShowNewForm(false)}
          folders={folders}
          allTags={allTags}
          onSuccess={() => {
            setShowNewForm(false)
            showToast('Erro cadastrado com sucesso!')
            loadFolders()
            if (currentFolder && !currentFolder.startsWith('[search]') && mainView === 'erros') {
              loadFiles(currentFolder)
            }
          }}
        />
      )}

      {/* Notificações temporárias (toast) */}
      <Toast {...toast} />

      {/* Modal de criar pasta */}
      {modals.newFolder && (
        <NewFolderModal onClose={() => setModals(p => ({ ...p, newFolder: false }))} onCreate={handleCreateFolder} />
      )}
      {/* Modal de renomear pasta */}
      {modals.renameFolder && (
        <RenameFolderModal currentName={selectedFolderForRename} onClose={() => setModals(p => ({ ...p, renameFolder: false }))} onRename={handleRenameFolder} />
      )}
      {/* Painel de busca avançada */}
      {showAdvancedSearch && (
        <AdvancedSearchPanel onSearch={handleAdvancedSearch} onClose={() => setShowAdvancedSearch(false)} />
      )}
      {/* Popup com o conteúdo do erro aberto */}
      {errorPopup.show && (
        <ErrorPopup file={errorPopup.file} onClose={handleCloseErrorPopup} onMove={handleMoveFile} folders={folders} />
      )}

      {/* Modal com a lista de atalhos de teclado */}
      {showShortcuts && (
        <div className="shortcuts-modal" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-content" onClick={e => e.stopPropagation()}>
            <h2><FiCommand size={20} /> Atalhos de Teclado</h2>
            <div className="shortcut-row"><span className="shortcut-desc">Buscar</span><span className="shortcut-key">Ctrl + K</span></div>
            <div className="shortcut-row"><span className="shortcut-desc">Novo erro</span><span className="shortcut-key">Ctrl + N</span></div>
            <div className="shortcut-row"><span className="shortcut-desc">Atalhos</span><span className="shortcut-key">Ctrl + /</span></div>
            <div className="shortcut-row"><span className="shortcut-desc">Fechar popup</span><span className="shortcut-key">Esc</span></div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="secondary" onClick={() => setShowShortcuts(false)}><FiX size={14} /> Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
