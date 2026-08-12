import { useState, useEffect, useCallback, useMemo } from 'react'
import { io } from 'socket.io-client'
import { api } from './services/api'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import FilePanel from './components/FilePanel'
import Dashboard from './components/Dashboard'
import Toast from './components/Toast'
import NewFileModal from './components/Modals/NewFileModal'
import NewFolderModal from './components/Modals/NewFolderModal'
import RenameFolderModal from './components/Modals/RenameFolderModal'
import MoveFileModal from './components/Modals/MoveFileModal'
import TrashPanel from './components/TrashPanel'
import TagsPanel from './components/TagsPanel'
import RelatoriosPanel from './components/RelatoriosPanel'
import AdvancedSearchPanel from './components/AdvancedSearchPanel'
import DiarioPanel from './components/DiarioPanel'
import SplashScreen from './components/SplashScreen'
import PublicForm from './components/PublicForm'
import ErrorPopup from './components/ErrorPopup'
import { FiX, FiCommand, FiEdit } from 'react-icons/fi'

export default function App() {
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [favorites, setFavorites] = useState([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [modals, setModals] = useState({ newFile: false, newFolder: false, renameFolder: false, moveFile: false })
  const [selectedFolderForRename, setSelectedFolderForRename] = useState('')
  const [showTrash, setShowTrash] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [mainView, setMainView] = useState('dashboard')
  const [folderRefreshTrigger, setFolderRefreshTrigger] = useState(0)
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [errorPopup, setErrorPopup] = useState({ show: false, file: null })
  const [theme, setTheme] = useState(() => localStorage.getItem('aps-theme') || 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [currentModule, setCurrentModule] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [allTags, setAllTags] = useState([])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('aps-theme', theme)
  }, [theme])

  const sortedFiles = useMemo(() => {
    const arr = [...files]
    if (sortBy === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'folder') arr.sort((a, b) => (a.folder || '').localeCompare(b.folder || ''))
    else if (sortBy === 'recent') arr.sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
    return arr
  }, [files, sortBy])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2500)
  }, [])

  const loadFolders = useCallback(async () => {
    const data = await api.getFolders()
    setFolders(data)
  }, [])

  const loadFavorites = useCallback(async () => {
    const data = await api.getFavorites()
    setFavorites(data)
  }, [])

  const loadFiles = useCallback(async (folder) => {
    const data = await api.getFiles(folder)
    setFiles(data)
  }, [])

  const loadAllTags = useCallback(async () => {
    try {
      const res = await api.getTags()
      setAllTags(Object.keys(res || {}))
    } catch (e) {
      setAllTags([])
    }
  }, [])

  const handleSelectFolder = useCallback(async (folder) => {
    setCurrentFolder(folder)
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    setSelectedFiles([])
    await loadFiles(folder)
    setSidebarOpen(false)
  }, [loadFiles])

  const handleErrorPopup = useCallback(async (file) => {
    if (!file?.folder) return
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    setErrorPopup({ show: true, file })
  }, [])

  const handleCloseErrorPopup = useCallback(async () => {
    setErrorPopup({ show: false, file: null })
    if (currentFolder && !currentFolder.startsWith('[search]')) {
      await loadFiles(currentFolder)
    }
    await loadFolders()
  }, [currentFolder, loadFiles, loadFolders])

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

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    if (currentFolder && currentFolder.startsWith('[search]')) {
      setFiles([])
      setCurrentFolder('')
    }
  }, [currentFolder])

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

  const handleCreateFile = useCallback(async (name, folder) => {
    const now = new Date()
    const date = now.toLocaleDateString('pt-BR')
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const template = `# ${name}\n\n**Criado em:** ${date} ${time}\n**Sistema:** \n**Contexto / Quando acontece:** \n\n## Resolucao (passo a passo)\n\n1. \n2. \n3. \n\n## Observacao\n\n\n\n## Tags\n\n- `
    await api.createFile(folder, name, template)
    setModals(prev => ({ ...prev, newFile: false }))
    await handleSelectFolder(folder)
    setFolderRefreshTrigger(prev => prev + 1)
    showToast('Criado com sucesso!')
  }, [handleSelectFolder, showToast])

  const handleCreateFolder = useCallback(async (name) => {
    const result = await api.createFolder(name)
    if (result.error) { showToast(result.error, 'error'); return }
    setModals(prev => ({ ...prev, newFolder: false }))
    await loadFolders()
    showToast('Pasta criada!')
  }, [loadFolders, showToast])

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

  const handleDeleteFolder = useCallback(async (folderPath) => {
    if (!confirm(`Excluir a pasta "${folderPath}"? Arquivos serao movidos para lixeira.`)) return
    const result = await api.deleteFolder(folderPath)
    showToast(result.movedFiles > 0 ? `Pasta excluida! ${result.movedFiles} arquivo(s) movido(s)` : 'Pasta excluida!')
    await loadFolders()
  }, [loadFolders, showToast])

  const handleRestoreFromTrash = useCallback(async (filename) => {
    await api.restoreFromTrash(filename)
    await loadFolders()
    setFolderRefreshTrigger(prev => prev + 1)
    if (currentFolder && !currentFolder.startsWith('[search]') && mainView === 'erros') {
      await loadFiles(currentFolder)
    }
    showToast('Arquivo restaurado!')
  }, [loadFolders, loadFiles, currentFolder, mainView, showToast])

  const handleDeleteFromTrash = useCallback(async (filename) => {
    if (!confirm('Excluir permanentemente?')) return
    await api.deleteFromTrash(filename)
    showToast('Excluido permanentemente!')
  }, [showToast])

  const handleEmptyTrash = useCallback(async () => {
    if (!confirm('Esvaziar a lixeira?')) return
    await api.emptyTrash()
    showToast('Lixeira esvaziada!')
  }, [showToast])

  const handleMoveFile = useCallback(async (targetFolder) => {
    if (!targetFolder || targetFolder === currentFolder) return
    const filename = errorPopup.file?.filename || errorPopup.file?.name + '.md'
    await api.moveFile(currentFolder, filename, targetFolder)
    setModals(prev => ({ ...prev, moveFile: false }))
    await loadFiles(currentFolder)
    await loadFolders()
    setFolderRefreshTrigger(prev => prev + 1)
    handleCloseErrorPopup()
    showToast('Arquivo movido!')
  }, [currentFolder, errorPopup.file, loadFiles, loadFolders, handleCloseErrorPopup, showToast])

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

  useEffect(() => {
    loadFolders()
    loadFavorites()
  }, [loadFolders, loadFavorites])

  useEffect(() => {
    const socket = io()
    socket.on('data-changed', () => {
      loadFolders()
      loadFavorites()
      if (currentFolder && !currentFolder.startsWith('[search]') && mainView === 'erros') {
        loadFiles(currentFolder)
      }
    })
    return () => socket.disconnect()
  }, [loadFolders, loadFavorites, loadFiles, currentFolder, mainView])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput')?.focus() }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowNewForm(true) }
      if (e.key === 'Escape') {
        if (errorPopup.show) handleCloseErrorPopup()
        else if (showAdvancedSearch) setShowAdvancedSearch(false)
        else if (showShortcuts) setShowShortcuts(false)
      }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowShortcuts(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [errorPopup.show, showAdvancedSearch, showShortcuts, handleCloseErrorPopup])

  if (window.location.pathname === '/cadastrar') {
    return <PublicForm />
  }

  if (showSplash) {
    return <SplashScreen onEnter={(moduleId) => { setCurrentModule(moduleId); setShowSplash(false) }} />
  }

  return (
    <div className="app" data-module={currentModule || 'aps'}>
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
      />

      {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}

      {currentModule === 'diario' ? (
        <div className="dashboard-full"><DiarioPanel /></div>
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

      {showNewForm && (
        <PublicForm
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
          onLoadTags={loadAllTags}
        />
      )}

      <Toast {...toast} />

      {modals.newFile && (
        <NewFileModal folders={folders} onClose={() => setModals(p => ({ ...p, newFile: false }))} onCreate={handleCreateFile} />
      )}
      {modals.newFolder && (
        <NewFolderModal onClose={() => setModals(p => ({ ...p, newFolder: false }))} onCreate={handleCreateFolder} />
      )}
      {modals.renameFolder && (
        <RenameFolderModal currentName={selectedFolderForRename} onClose={() => setModals(p => ({ ...p, renameFolder: false }))} onRename={handleRenameFolder} />
      )}
      {modals.moveFile && (
        <MoveFileModal folders={folders} currentFolder={currentFolder} onClose={() => setModals(p => ({ ...p, moveFile: false }))} onMove={handleMoveFile} />
      )}
      {showAdvancedSearch && (
        <AdvancedSearchPanel onSearch={handleAdvancedSearch} onClose={() => setShowAdvancedSearch(false)} />
      )}
      {errorPopup.show && (
        <ErrorPopup file={errorPopup.file} onClose={handleCloseErrorPopup} onMove={(target) => { handleMoveFile(target); handleCloseErrorPopup() }} folders={folders} />
      )}

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
