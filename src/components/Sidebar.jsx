import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiStar, FiFolder, FiPlus, FiTrash2, FiFolderMinus } from 'react-icons/fi'

export default function Sidebar({
  folders,
  favorites,
  currentFolder,
  onSelectFolder,
  onSelectFile,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFavorite,
  onShowTrash,
  showTrash,
  refreshTrigger,
  className
}) {
  const [folderCounts, setFolderCounts] = useState({})

  useEffect(() => {
    const loadCounts = async () => {
      const counts = {}
      for (const folder of folders) {
        const files = await api.getFiles(folder.path)
        counts[folder.path] = files.length
      }
      setFolderCounts(counts)
    }
    if (folders.length > 0) loadCounts()
  }, [folders, refreshTrigger])

  return (
    <aside className={`sidebar ${className || ''}`}>
      <div className="sidebar-section">
        <h3><FiStar size={12} /> Favoritos</h3>
        {favorites.length === 0 ? (
          <div className="nav-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
            Nenhum favorito
          </div>
        ) : (
          favorites.map((fav) => (
            <div
              key={`${fav.folder}-${fav.filename}`}
              className="nav-item"
              onClick={() => onSelectFile({ folder: fav.folder, filename: fav.filename })}
            >
              <span><FiStar size={12} style={{ marginRight: 8, color: 'var(--accent-yellow)' }} />{fav.filename.replace('.md', '')}</span>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-section">
        <h3><FiFolder size={12} /> Pastas</h3>
        <button onClick={onNewFolder} style={{ width: '100%', marginBottom: '8px' }}>
          <FiPlus size={14} /> Nova Pasta
        </button>
      </div>

      <ul className="folder-list">
        {folders.map((folder) => (
          <li
            key={folder.path}
            className={`nav-item ${currentFolder === folder.path ? 'active' : ''}`}
            onClick={() => onSelectFolder(folder.path)}
            onContextMenu={(e) => {
              e.preventDefault()
              onRenameFolder(folder.path)
            }}
          >
            <span className="folder-name"><FiFolder size={14} style={{ marginRight: 8 }} />{folder.name}</span>
            <div className="folder-actions">
              <span className="count">{folderCounts[folder.path] || 0}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteFolder(folder.path)
                }}
                style={{ padding: '4px 8px', fontSize: '11px' }}
                className="danger"
              >
                <FiTrash2 size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="trash-section">
        <div
          className={`trash-btn ${showTrash ? 'active' : ''}`}
          onClick={onShowTrash}
        >
          <FiFolderMinus size={18} />
          <span>Erros Não Catalogados</span>
        </div>
      </div>
    </aside>
  )
}
