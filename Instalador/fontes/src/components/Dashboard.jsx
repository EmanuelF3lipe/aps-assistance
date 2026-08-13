import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { FiTag, FiEdit3, FiCheck, FiX } from 'react-icons/fi'
import PasswordPanel from './PasswordPanel'

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
]

export default function Dashboard({ onSelectFile }) {
  const [stats, setStats] = useState(null)
  const [folders, setFolders] = useState([])
  const [folderColors, setFolderColors] = useState({})
  const [editingFolder, setEditingFolder] = useState(null)
  const [selectedColor, setSelectedColor] = useState('#3b82f6')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [statsData, foldersData, colorsData] = await Promise.all([
      api.getStats(),
      api.getFolders(),
      api.getFolderColors()
    ])
    setStats(statsData)
    setFolders(foldersData)
    setFolderColors(colorsData)
  }

  if (!stats) return null

  const handleSaveColor = async (folder) => {
    await api.setFolderColor(folder, selectedColor)
    setFolderColors({ ...folderColors, [folder]: selectedColor })
    setEditingFolder(null)
  }

  const handleRemoveColor = async (folder) => {
    await api.removeFolderColor(folder)
    const newColors = { ...folderColors }
    delete newColors[folder]
    setFolderColors(newColors)
    setEditingFolder(null)
  }

  return (
    <div className="dashboard">
      <h2>Visao Geral</h2>

      <PasswordPanel />

      <div className="stats-grid">
        {folders.map((folder) => {
          const color = folderColors[folder.name] || DEFAULT_COLORS[folders.indexOf(folder) % DEFAULT_COLORS.length]
          const count = stats.byFolder[folder.name] || 0
          const isEditing = editingFolder === folder.name

          return (
            <div key={folder.name} className="stat-card" style={{ borderColor: color }}>
              <div className="label" style={{ color }}>{folder.name.toUpperCase()}</div>
              <div className="value" style={{ color }}>{count}</div>
              <button
                className="edit-color-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingFolder(isEditing ? null : folder.name)
                  setSelectedColor(folderColors[folder.name] || color)
                }}
                title="Escolher cor"
              >
                <FiEdit3 size={12} />
              </button>
              {isEditing && (
                <div className="color-picker-inline" onClick={(e) => e.stopPropagation()}>
                  <div className="color-options">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`color-option ${selectedColor === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setSelectedColor(c)}
                      />
                    ))}
                  </div>
                  <div className="color-actions">
                    <button className="success" onClick={() => handleSaveColor(folder.name)}>
                      <FiCheck size={12} />
                    </button>
                    <button className="secondary" onClick={() => handleRemoveColor(folder.name)}>
                      <FiX size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="section-title">
        <FiTag size={14} /> Recentes
      </div>
      <div className="recent-list">
        {stats.recentFiles.map((file) => (
          <div
            key={`${file.folder}-${file.filename}`}
            className="recent-item"
            onClick={() => onSelectFile(file.folder, file.filename)}
          >
            <span className="name">{file.name}</span>
            <span className="folder">{file.folder}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
