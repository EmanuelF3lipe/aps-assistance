import { useState, useEffect, useCallback } from 'react'
import { api } from './services/api'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import FilePanel from './components/FilePanel'
import ContentPanel from './components/ContentPanel'
import Dashboard from './components/Dashboard'
import Toast from './components/Toast'
import NewFileModal from './components/Modals/NewFileModal'
import NewFolderModal from './components/Modals/NewFolderModal'
import RenameFolderModal from './components/Modals/RenameFolderModal'
import MoveFileModal from './components/Modals/MoveFileModal'
import TrashPanel from './components/TrashPanel'
import TagsPanel from './components/TagsPanel'
import RelatoriosPanel from './components/RelatoriosPanel'
import SplashScreen from './components/SplashScreen'

export default function App() {
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [favorites, setFavorites] = useState([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [currentFile, setCurrentFile] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [modals, setModals] = useState({
    newFile: false,
    newFolder: false,
    renameFolder: false,
    moveFile: false
  })
  const [selectedFolderForRename, setSelectedFolderForRename] = useState('')
  const [showTrash, setShowTrash] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [mainView, setMainView] = useState('dashboard')

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

  const handleSelectFolder = useCallback(async (folder) => {
    setCurrentFolder(folder)
    setCurrentFile(null)
    setFileContent(null)
    setIsEditing(false)
    setMainView('erros')
    setShowTrash(false)
    setShowTags(false)
    await loadFiles(folder)
  }, [loadFiles])

  const handleSelectFile = useCallback(async (folder, filename) => {
    setCurrentFolder(folder)
    setCurrentFile(filename)
    setIsEditing(false)
    setMainView('erros')
    setShowTags(false)
    setShowTrash(false)
    const data = await api.getFile(folder, filename)
    setFileContent(data.content)
  }, [])

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query)
    if (!query) {
      if (currentFolder && !currentFolder.startsWith('🔍')) {
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
    setCurrentFolder(`🔍 "${query}"`)
    const results = await api.search(query)
    setFiles(results.map(r => ({ ...r, name: r.filename.replace('.md', '') })))
  }, [currentFolder, loadFiles])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    if (currentFolder) {
      handleSelectFolder(currentFolder)
    }
  }, [currentFolder, handleSelectFolder])

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

  const handleSaveFile = useCallback(async (content) => {
    await api.updateFile(currentFolder, currentFile, content)
    setFileContent(content)
    setIsEditing(false)
    showToast('Salvo com sucesso!')
  }, [currentFolder, currentFile, showToast])

  const handleUpdateTags = useCallback(async (folder, filename, tags) => {
    await api.updateTags(folder, filename, tags)
    const data = await api.getFile(folder, filename)
    setFileContent(data.content)
    showToast('Tags atualizadas!')
  }, [showToast])

  const handleDeleteFile = useCallback(async () => {
    if (!confirm('Excluir este erro?')) return
    await api.deleteFile(currentFolder, currentFile)
    showToast('Excluido!')
    setCurrentFile(null)
    setFileContent(null)
    await loadFiles(currentFolder)
    await loadFolders()
  }, [currentFolder, currentFile, loadFiles, loadFolders, showToast])

  const handleRenameFile = useCallback(async (newName) => {
    if (!newName || newName === currentFile?.replace('.md', '')) return
    await api.renameFile(currentFolder, currentFile, newName)
    setCurrentFile(newName + '.md')
    await loadFiles(currentFolder)
    showToast('Titulo atualizado!')
  }, [currentFolder, currentFile, loadFiles, showToast])

  const handleMoveFile = useCallback(async (targetFolder) => {
    if (!targetFolder || targetFolder === currentFolder) return
    await api.moveFile(currentFolder, currentFile, targetFolder)
    setCurrentFolder(targetFolder)
    setCurrentFile(null)
    setFileContent(null)
    await loadFiles(targetFolder)
    await loadFolders()
    showToast('Arquivo movido!')
  }, [currentFolder, currentFile, loadFiles, loadFolders, showToast])

  const handleCreateFile = useCallback(async (name, folder) => {
    const template = `# ${name}

**Criado em:** ${new Date().toLocaleDateString('pt-BR')}
**Sistema:** 
**Contexto:** 

## Resolucao

[Descreva a solucao aqui]

## Tags
- tag1
- tag2`

    await api.createFile(folder, name, template)
    setModals(prev => ({ ...prev, newFile: false }))
    await handleSelectFolder(folder)
    showToast('Criado com sucesso!')
  }, [handleSelectFolder, showToast])

  const handleCreateFolder = useCallback(async (name) => {
    const result = await api.createFolder(name)
    if (result.error) {
      showToast(result.error, 'error')
      return
    }
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
    if (result.error) {
      showToast(result.error, 'error')
      return
    }
    setModals(prev => ({ ...prev, renameFolder: false }))
    await loadFolders()
    showToast('Pasta renomeada!')
  }, [selectedFolderForRename, loadFolders, showToast])

  const handleDeleteFolder = useCallback(async (folderPath) => {
    if (!confirm(`Excluir a pasta "${folderPath}"? Os arquivos serao movidos para "Erros Nao Catalogados".`)) return
    const result = await api.deleteFolder(folderPath)
    if (result.movedFiles > 0) {
      showToast(`Pasta excluida! ${result.movedFiles} arquivo(s) movido(s) para lixo`)
    } else {
      showToast('Pasta excluida!')
    }
    await loadFolders()
  }, [loadFolders, showToast])

  const openRenameFolderModal = useCallback((path) => {
    setSelectedFolderForRename(path)
    setModals(prev => ({ ...prev, renameFolder: true }))
  }, [])

  const handleRestoreFromTrash = useCallback(async (filename) => {
    await api.restoreFromTrash(filename)
    await loadFolders()
    showToast('Arquivo restaurado!')
  }, [loadFolders, showToast])

  const handleDeleteFromTrash = useCallback(async (filename) => {
    if (!confirm('Excluir permanentemente este arquivo?')) return
    await api.deleteFromTrash(filename)
    showToast('Excluido permanentemente!')
  }, [showToast])

  const handleEmptyTrash = useCallback(async () => {
    if (!confirm('Esvaziar a lixeira? Todos os arquivos serao excluidos permanentemente.')) return
    await api.emptyTrash()
    showToast('Lixeira esvaziada!')
  }, [showToast])

  useEffect(() => {
    loadFolders()
    loadFavorites()
  }, [loadFolders, loadFavorites])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        document.getElementById('searchInput')?.focus()
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        setModals(prev => ({ ...prev, newFile: true }))
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        if (fileContent) setIsEditing(true)
      }
      if (e.key === 'Escape') {
        setIsEditing(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fileContent])

  if (showSplash) {
    return <SplashScreen onEnter={() => setShowSplash(false)} />
  }

  const showWorkspace = mainView === 'erros'

  return (
    <div className="app">
      <Header
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        onNewFile={() => setModals(prev => ({ ...prev, newFile: true }))}
        mainView={mainView}
        onSwitchView={() => setMainView(mainView === 'erros' ? 'dashboard' : 'erros')}
        onShowTags={() => {
          setMainView('erros')
          setShowTrash(false)
          setShowTags(true)
        }}
        onShowRelatorios={() => {
          setMainView('relatorios')
          setShowTags(false)
          setShowTrash(false)
        }}
        onShowDashboard={() => {
          setMainView('dashboard')
          setShowTags(false)
          setShowTrash(false)
        }}
        onSearchByTag={(tag) => {
          setSearchQuery(tag)
          handleSearch(tag)
          setShowTags(false)
        }}
      />

      {showWorkspace ? (
        <div className="workspace">
          <Sidebar
            folders={folders}
            favorites={favorites}
            currentFolder={currentFolder}
            onSelectFolder={handleSelectFolder}
            onSelectFile={handleSelectFile}
            onNewFolder={() => setModals(prev => ({ ...prev, newFolder: true }))}
            onRenameFolder={openRenameFolderModal}
            onDeleteFolder={handleDeleteFolder}
            onToggleFavorite={handleToggleFavorite}
            onShowTrash={() => setShowTrash(true)}
            showTrash={showTrash}
          />

          <FilePanel
            currentFolder={currentFolder}
            files={files}
            currentFile={currentFile}
            onSelectFile={handleSelectFile}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />

          <div className="content-panel">
            {showTrash ? (
              <TrashPanel
                onRestore={handleRestoreFromTrash}
                onDelete={handleDeleteFromTrash}
                onEmpty={handleEmptyTrash}
                onBack={() => setShowTrash(false)}
              />
            ) : showTags ? (
              <TagsPanel onSelectFile={handleSelectFile} />
            ) : (
              <ContentPanel
                currentFile={currentFile}
                currentFolder={currentFolder}
                fileContent={fileContent}
                isEditing={isEditing}
                onStartEdit={() => setIsEditing(true)}
                onCancelEdit={() => setIsEditing(false)}
                onSave={handleSaveFile}
                onDelete={handleDeleteFile}
                onCopy={() => {
                  navigator.clipboard.writeText(fileContent)
                  showToast('Copiado!')
                }}
                onRename={handleRenameFile}
                onMove={() => setModals(prev => ({ ...prev, moveFile: true }))}
                onUpdateTags={handleUpdateTags}
                onUpdateContent={(content) => setFileContent(content)}
              />
            )}
          </div>
        </div>
      ) : mainView === 'relatorios' ? (
        <div className="dashboard-full">
          <RelatoriosPanel />
        </div>
      ) : (
        <div className="dashboard-full">
          <Dashboard onSelectFile={handleSelectFile} />
        </div>
      )}

      <Toast {...toast} />

      {modals.newFile && (
        <NewFileModal
          folders={folders}
          onClose={() => setModals(prev => ({ ...prev, newFile: false }))}
          onCreate={handleCreateFile}
        />
      )}

      {modals.newFolder && (
        <NewFolderModal
          onClose={() => setModals(prev => ({ ...prev, newFolder: false }))}
          onCreate={handleCreateFolder}
        />
      )}

      {modals.renameFolder && (
        <RenameFolderModal
          currentName={selectedFolderForRename}
          onClose={() => setModals(prev => ({ ...prev, renameFolder: false }))}
          onRename={handleRenameFolder}
        />
      )}

      {modals.moveFile && (
        <MoveFileModal
          folders={folders}
          currentFolder={currentFolder}
          onClose={() => setModals(prev => ({ ...prev, moveFile: false }))}
          onMove={handleMoveFile}
        />
      )}
    </div>
  )
}
